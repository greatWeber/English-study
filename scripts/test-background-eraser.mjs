import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TEST_DIST_DIR = '.next-test-background-eraser';
const VIEWPORT = { width: 1000, height: 650 };
const STORAGE_KEY = 'dicta…Mode';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ].filter(Boolean);

  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : 0;
      server.close(() => resolve(port));
    });
  });
}

async function waitForHttp(url, timeoutMs = 120_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(200);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message || 'unknown error'}`);
}

async function waitForCdp(port, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const targets = await response.json();
      const page = targets.find((target) => target.type === 'page');
      if (page) return page;
    } catch (error) {
      lastError = error;
    }
    await sleep(100);
  }
  throw new Error(`Chrome DevTools endpoint did not become ready: ${lastError?.message || 'unknown error'}`);
}

class CdpClient {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 0;
    this.pending = new Map();
    socket.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      if (!message.id || !this.pending.has(message.id)) return;
      const entry = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) entry.reject(new Error(JSON.stringify(message.error)));
      else entry.resolve(message.result);
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.nextId;
      this.pending.set(id, { resolve, reject });
      this.socket.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (result.exceptionDetails) {
      throw new Error(`Browser evaluation failed: ${JSON.stringify(result.exceptionDetails)}`);
    }
    return result.result.value;
  }

  async waitFor(expression, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await this.evaluate(expression)) return;
      await sleep(100);
    }
    throw new Error(`Timed out waiting for browser condition: ${expression}`);
  }
}

async function openClient(wsUrl) {
  const socket = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    socket.once('open', resolve);
    socket.once('error', reject);
  });
  return new CdpClient(socket);
}

async function main() {
  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error(
      'Chrome/Chromium was not found. Set CHROME_PATH to a Chrome executable before running this test.',
    );
  }

  const appPort = await getFreePort();
  const debugPort = await getFreePort();
  const baseUrl = `http://127.0.0.1:${appPort}`;
  const profileDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dictation-eraser-chrome-'));
  const nextBin = path.join(
    ROOT,
    'node_modules',
    '.bin',
    process.platform === 'win32' ? 'next.cmd' : 'next',
  );

  let app;
  let chrome;
  let client;

  try {
    app = spawn(nextBin, ['dev', '-p', String(appPort)], {
      cwd: ROOT,
      env: {
        ...process.env,
        NEXT_DIST_DIR: TEST_DIST_DIR,
        NEXT_TELEMETRY_DISABLED: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const appLog = [];
    app.stdout.on('data', (chunk) => appLog.push(chunk.toString()));
    app.stderr.on('data', (chunk) => appLog.push(chunk.toString()));

    await waitForHttp(baseUrl);

    chrome = spawn(
      chromePath,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--remote-debugging-port=' + debugPort,
        '--user-data-dir=' + profileDir,
        'about:blank',
      ],
      { stdio: 'ignore' },
    );

    const page = await waitForCdp(debugPort);
    client = await openClient(page.webSocketDebuggerUrl);

    await client.send('Page.enable');
    await client.send('Runtime.enable');
    await client.send('Emulation.setDeviceMetricsOverride', {
      ...VIEWPORT,
      deviceScaleFactor: 1,
      mobile: false,
    });

    // 模拟用户此前已保存“橡皮擦揭示”偏好：必须在应用脚本运行前写入，
    // 否则运行中切换模式会重新挂载组件，掩盖“内容加载后画布变高”的竞态。
    await client.send('Page.addScriptToEvaluateOnNewDocument', {
      source: `try { localStorage.setItem(${JSON.stringify(STORAGE_KEY)}, 'reveal'); } catch {}`,
    });
    await client.send('Page.navigate', { url: baseUrl });

    await client.waitFor(`
      document.body.innerText.includes('学习路线') &&
      Boolean(document.querySelector('canvas[data-background-layer="base"]')) &&
      document.documentElement.scrollHeight > window.innerHeight + 100
    `);
    await sleep(500);

    await client.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)');
    await sleep(200);
    await client.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: Math.round(VIEWPORT.width / 2),
      y: Math.round(VIEWPORT.height / 2),
      button: 'none',
    });
    await sleep(300);

    const report = await client.evaluate(`(() => {
      const base = document.querySelector('canvas[data-background-layer="base"]');
      const veil = document.querySelector('canvas[data-background-layer="veil"]');
      if (!base || !veil) return { error: 'eraser canvases not found' };

      const scrollY = window.scrollY;
      const rect = base.getBoundingClientRect();
      const documentTop = rect.top + scrollY;
      const ratio = base.width / rect.width;
      const sampleX = Math.floor((${JSON.stringify(VIEWPORT.width)} / 2 - rect.left) * ratio);
      const sampleY = Math.floor((scrollY + ${JSON.stringify(VIEWPORT.height)} / 2 - documentTop) * ratio);
      const sampleSize = Math.max(1, Math.floor(80 * ratio));

      let visiblePatternAlpha = 0;
      if (sampleY >= 0 && sampleY + sampleSize <= base.height) {
        const data = base.getContext('2d').getImageData(
          sampleX,
          sampleY,
          sampleSize,
          sampleSize,
        ).data;
        for (let index = 3; index < data.length; index += 4) {
          visiblePatternAlpha += data[index];
        }
      }

      return {
        viewportHeight: window.innerHeight,
        scrollHeight: document.documentElement.scrollHeight,
        scrollY,
        baseCssHeight: Number.parseFloat(base.style.height || String(rect.height)),
        baseBackingHeight: base.height,
        veilCssHeight: Number.parseFloat(veil.style.height || String(veil.getBoundingClientRect().height)),
        visiblePatternAlpha,
      };
    })()`);

    assert.equal(report.error, undefined, report.error);
    assert.ok(
      report.scrollHeight > report.viewportHeight + 100,
      `test page must be scrollable; got ${JSON.stringify(report)}`,
    );
    assert.ok(
      report.baseCssHeight >= Math.min(report.scrollHeight, 10_000) - 2,
      `base canvas must cover the document; got ${JSON.stringify(report)}`,
    );
    assert.ok(
      report.veilCssHeight >= Math.min(report.scrollHeight, 10_000) - 2,
      `veil canvas must cover the document; got ${JSON.stringify(report)}`,
    );
    assert.ok(
      report.visiblePatternAlpha > 0,
      `the doodle pattern must remain visible after scrolling; got ${JSON.stringify(report)}`,
    );

    // 其他背景模式及实时切换不能因本次尺寸同步改动而回归。
    const switchMode = async (label, expectedMode) => {
      const clicked = await client.evaluate(`(() => {
        const button = [...document.querySelectorAll('button')]
          .find((item) => item.innerText.trim() === ${JSON.stringify(label)});
        if (!button) return false;
        button.click();
        return true;
      })()`);
      assert.ok(clicked, `background mode button not found: ${label}`);
      await client.waitFor(
        `localStorage.getItem(${JSON.stringify(STORAGE_KEY)}) === ${JSON.stringify(expectedMode)}`,
      );
    };

    await switchMode('磁吸点阵', 'dots');
    await client.waitFor(`!document.querySelector('canvas[data-background-layer="base"]')`);

    await switchMode('纯点阵', 'dotsOnly');
    await client.waitFor(`!document.querySelector('canvas[data-background-layer="veil"]')`);

    await switchMode('橡皮擦揭示', 'reveal');
    await client.waitFor(`
      Boolean(document.querySelector('canvas[data-background-layer="base"]')) &&
      Boolean(document.querySelector('canvas[data-background-layer="veil"]'))
    `);

    console.log('PASS background eraser covers the whole scrollable document');
    console.log('PASS background modes and live switching still work');
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    console.error('FAIL background eraser regression');
    console.error(error);
    process.exitCode = 1;
  } finally {
    client?.socket.close();
    chrome?.kill('SIGTERM');
    app?.kill('SIGTERM');
    await sleep(200);
    fs.rmSync(profileDir, { recursive: true, force: true });
    fs.rmSync(path.join(ROOT, TEST_DIST_DIR), { recursive: true, force: true });
  }
}

await main();

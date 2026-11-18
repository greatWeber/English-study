// 启动 dev / build 前自检 better-sqlite3 原生模块的 ABI 是否与当前 Node 匹配。
// nvm 切换 Node 版本后，.node 二进制不会跟着重编译，会报 NODE_MODULE_VERSION 不匹配。
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);

function works() {
  try {
    const Database = require('better-sqlite3');
    const db = new Database(':memory:');
    db.prepare('select 1 as ok').get();
    db.close();
    return true;
  } catch {
    return false;
  }
}

if (!works()) {
  console.log(
    `[ensure-better-sqlite3] 原生模块与当前 Node ${process.version} 不匹配，正在重新编译…`,
  );
  const result = spawnSync('npm', ['rebuild', 'better-sqlite3', '--foreground-scripts'], {
    stdio: 'inherit',
  });
  if (result.status !== 0 || !works()) {
    console.error(
      '[ensure-better-sqlite3] 自动修复失败，请手动运行：npm rebuild better-sqlite3',
    );
    process.exit(1);
  }
  console.log('[ensure-better-sqlite3] 已修复。');
}

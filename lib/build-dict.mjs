/**
 * 构建离线单词词典表 word_dict（幂等，可重复执行）
 *
 * 数据源：ECDICT（https://github.com/skywind3000/ECDICT，MIT 协议，全量 77 万词条）。
 * GitHub 直连不通，所以从 npm 的 `ecdict` 包里取同一份 ecdict.csv（63MB）。
 * 原始 CSV 不进仓库，只保留筛好的常用词表（约 6 万行，几 MB）。
 *
 * 筛选规则（只要「有理由认为用户会查」的词）：
 *   - 纯字母词形（含连字符），长度 2~24
 *   - 有中文释义
 *   - 且满足任一信号：Collins 星级 / 牛津3000 / 考试标签(zk gk cet4…) / BNC·FRQ 词频
 *
 * 另外把 exchange 字段里的变形指针（walks/walking/walked → walk）单独展开成行，
 * 这样查 "walked" 不必在前端做词形还原，直接命中并显示「walk 的过去式」。
 *
 * 运行：npm run build:dict  （可选环境变量 ECDICT_CSV 指向本地 CSV 以跳过下载）
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import https from 'node:https';
import Database from 'better-sqlite3';

const TARBALL_URL =
  process.env.ECDICT_TARBALL || 'https://registry.npmjs.org/ecdict/-/ecdict-0.0.4.tgz';
const DB_PATH = process.env.DICTATION_DB_PATH || path.join(process.cwd(), 'data', 'dictation.db');
const TMP_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ecdict-'));

/* ============================================================ 下载并解出 CSV */

function download(url, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('重定向次数过多'));
    https
      .get(url, (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          return resolve(download(new URL(res.headers.location, url).toString(), dest, redirects + 1));
        }
        if (res.statusCode !== 200) {
          res.resume();
          return reject(new Error(`下载失败 HTTP ${res.statusCode}: ${url}`));
        }
        const out = fs.createWriteStream(dest);
        res.pipe(out);
        out.on('finish', () => out.close(() => resolve(dest)));
        out.on('error', reject);
      })
      .on('error', reject);
  });
}

async function resolveCsv() {
  if (process.env.ECDICT_CSV) {
    console.log(`[dict] 使用本地 CSV：${process.env.ECDICT_CSV}`);
    return process.env.ECDICT_CSV;
  }
  const tgz = path.join(TMP_DIR, 'ecdict.tgz');
  console.log(`[dict] 下载 ECDICT：${TARBALL_URL}`);
  await download(TARBALL_URL, tgz);
  const csv = path.join(TMP_DIR, 'ecdict.csv');
  await new Promise((resolve, reject) => {
    const tar = spawn('tar', ['-xzOf', tgz, 'package/assets/ecdict.csv'], { stdio: ['ignore', 'pipe', 'pipe'] });
    const out = fs.createWriteStream(csv);
    tar.stdout.pipe(out);
    tar.stderr.on('data', (d) => process.stderr.write(d));
    out.on('finish', () => out.close(() => resolve()));
    tar.on('error', reject);
    out.on('error', reject);
  });
  console.log(`[dict] 解压完成：${(fs.statSync(csv).size / 1048576).toFixed(1)} MB`);
  return csv;
}

/* ============================================================ CSV 解析 */

/**
 * ECDICT 的 CSV：字段用双引号包裹，内部 \n / \t 是字面量 "\\n"，
 * 但个别记录（多行引号块）会真的跨行，所以按「引号闭合」切记录，不能按行切。
 */
function parseRecords(buf) {
  const text = buf.toString('utf8');
  const QUOTE = '"';
  const records = [];
  let fields = [];
  let field = '';
  let inQuotes = false;
  let started = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (!started && ch !== '\n' && ch !== '\r') started = true;

    if (inQuotes) {
      if (ch === QUOTE) {
        if (text[i + 1] === QUOTE) {
          field += QUOTE;
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === QUOTE) {
      inQuotes = true;
      started = true;
    } else if (ch === ',') {
      fields.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      fields.push(field);
      field = '';
      if (fields.length > 1 || fields[0] !== '') records.push(fields);
      fields = [];
      started = false;
    } else {
      field += ch;
    }
  }
  if (field !== '' || fields.length) {
    fields.push(field);
    if (fields.length > 1 || fields[0] !== '') records.push(fields);
  }
  return records;
}

/** "\\n" 字面量 → 真换行，并清掉多余空白 */
const unescape = (s) =>
  (s || '')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, ' ')
    .split('\n')
    .map((x) => x.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

/** 中文释义：丢掉 [网络]/[地名] 这类噪声行，最多留 maxLines 条，单条过长则截断 */
function trimTranslation(raw, maxLines = 3, maxLen = 60) {
  const lines = unescape(raw).filter((l) => !/^\[(网络|地名|人名)\]/.test(l));
  const picked = lines.slice(0, maxLines).map((l) => (l.length > maxLen ? `${l.slice(0, maxLen)}…` : l));
  return picked.join('\n');
}

function trimDefinition(raw, maxLines = 2, maxLen = 90) {
  const picked = unescape(raw).slice(0, maxLines).map((l) => (l.length > maxLen ? `${l.slice(0, maxLen)}…` : l));
  return picked.join('\n');
}

/* ============================================================ 入库 */

const WORD_RE = /^[a-z][a-z-]{1,23}$/;

/** exchange 里的构词指针：s=复数/三单 i=ing p=过去式 d=过去分词 0=原形 1=比较级 3=最高级 r/t/f=派生 */
const INFLECTION_LABEL = {
  s: '复数 / 三单',
  i: '现在分词',
  p: '过去式',
  d: '过去分词',
  r: '比较级',
  t: '最高级',
  f: '派生词',
};

function baseRow(f) {
  const [word, phonetic, definition, translation, pos, collins, oxford, tag, bnc, frq] = f;
  return {
    word,
    phonetic: (phonetic || '').trim(),
    translation: trimTranslation(translation),
    definition: trimDefinition(definition),
    pos: (pos || '').trim(),
    collins: Number(collins) || 0,
    oxford: Number(oxford) || 0,
    tag: (tag || '').trim(),
    bnc: Number(bnc) || 0,
    frq: Number(frq) || 0,
    inf_of: '',
    inf_label: '',
  };
}

function main() {
  return resolveCsv().then((csv) => {
    const records = parseRecords(fs.readFileSync(csv));
    console.log(`[dict] CSV 记录数：${records.length}`);

    /** word → fields（用于把变形指针解析回原词） */
    const byWord = new Map();
    for (const f of records) {
      const w = (f[0] || '').toLowerCase();
      if (w && !byWord.has(w)) byWord.set(w, f);
    }

    const rows = new Map(); // word → row，Map 天然去重（先到先得）
    const inflections = []; // [变形词, 原词, 标签]

    // 第一遍：常用词本体。变形行必须等本体全齐了再生成，
    // 否则「A 本身是常用词、同时又是 B 的变形」时会读到还没写入的本体。
    for (const f of records) {
      const word = (f[0] || '').toLowerCase();
      if (!WORD_RE.test(word)) continue;
      const translation = f[3];
      if (!translation) continue;
      const hasSignal =
        Number(f[5]) > 0 || Number(f[6]) > 0 || (f[7] || '').trim() || Number(f[8]) > 0 || Number(f[9]) > 0;
      if (!hasSignal) continue;

      const row = baseRow(f);
      if (!row.translation) continue;
      if (!rows.has(word)) rows.set(word, row);
    }

    for (const f of records) {
      const word = (f[0] || '').toLowerCase();
      if (!rows.has(word)) continue; // 只为「会显示的原词」造变形入口
      const exchange = (f[10] || '').trim();
      if (!exchange) continue;
      for (const seg of exchange.split('/')) {
        const idx = seg.indexOf(':');
        if (idx <= 0) continue;
        const code = seg.slice(0, idx);
        const form = seg.slice(idx + 1).toLowerCase().trim();
        if (!/^[a-z][a-z-]{1,23}$/.test(form)) continue;
        const label = INFLECTION_LABEL[code];
        if (!label) continue;
        inflections.push([form, word, label]);
      }
    }

    console.log(`[dict] 常用词条：${rows.size}，变形指针：${inflections.length}`);

    if (!fs.existsSync(path.dirname(DB_PATH))) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');

    db.exec(`
      CREATE TABLE IF NOT EXISTS word_dict (
        word        TEXT PRIMARY KEY,
        phonetic    TEXT NOT NULL DEFAULT '',
        translation TEXT NOT NULL DEFAULT '',
        definition  TEXT NOT NULL DEFAULT '',
        pos         TEXT NOT NULL DEFAULT '',
        collins     INTEGER NOT NULL DEFAULT 0,
        oxford      INTEGER NOT NULL DEFAULT 0,
        tag         TEXT NOT NULL DEFAULT '',
        bnc         INTEGER NOT NULL DEFAULT 0,
        frq         INTEGER NOT NULL DEFAULT 0,
        inf_of      TEXT NOT NULL DEFAULT '',
        inf_label   TEXT NOT NULL DEFAULT ''
      );
      DELETE FROM word_dict;
    `);

    const insert = db.prepare(
      `INSERT OR REPLACE INTO word_dict
         (word, phonetic, translation, definition, pos, collins, oxford, tag, bnc, frq, inf_of, inf_label)
       VALUES (@word, @phonetic, @translation, @definition, @pos, @collins, @oxford, @tag, @bnc, @frq, @inf_of, @inf_label)`
    );

    const write = db.transaction(() => {
      for (const row of rows.values()) insert.run(row);

      let added = 0;
      for (const [form, base, label] of inflections) {
        if (form === base) continue;
        if (rows.has(form)) continue; // 本身是常用词，保留它自己的释义
        const parent = byWord.get(base);
        const parentRow = rows.get(base);
        if (!parent || !parentRow) continue;
        const row = {
          word: form,
          phonetic: (parent[1] || '').trim(),
          translation: parentRow.translation,
          definition: '',
          pos: parentRow.pos,
          collins: parentRow.collins,
          oxford: parentRow.oxford,
          tag: parentRow.tag,
          bnc: parentRow.bnc,
          frq: parentRow.frq,
          inf_of: base,
          inf_label: label,
        };
        rows.set(form, row);
        insert.run(row);
        added++;
      }
      return added;
    });

    const added = write();
    const total = db.prepare('SELECT COUNT(*) AS c FROM word_dict').get().c;
    const noPh = db.prepare("SELECT COUNT(*) AS c FROM word_dict WHERE phonetic = ''").get().c;
    db.close();

    console.log(`[dict] 变形词条新增：${added}`);
    console.log(`[dict] word_dict 总计：${total} 条（缺音标 ${noPh} 条）`);
    console.log(`[dict] 写入完成 → ${DB_PATH}`);
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });
}

main().catch((err) => {
  console.error('[dict] 构建失败：', err);
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  process.exit(1);
});

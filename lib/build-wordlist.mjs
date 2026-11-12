#!/usr/bin/env node
/**
 * build-wordlist.mjs — 从 CEFR-J + Octanove 词表构建「单词默写」词库表 word_cefr
 *
 * 数据来源（句子导入时已缓存在 legacy/scripts/.cache/，见 build-dataset.mjs）：
 *   - cefrj-vocab.csv   CEFR-J Vocabulary Profile v1.5（A1–B2，CC 要求署名）
 *   - octanove-c1c2.csv Octanove C1/C2 词表（CC BY-SA 4.0）
 *
 * 只保留 word_dict 里有中文释义的原形词条（变形词条不进词库），
 * 这样默写题目天然带音标 + 释义，完全离线。
 *
 * 用法：npm run build:words   （需先 npm run build:dict）
 */
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const DB_PATH = process.env.DICTATION_DB_PATH || path.join(ROOT, 'data', 'dictation.db');
const CACHE_DIR = path.join(ROOT, 'legacy', 'scripts', '.cache');
const CEFRJ = path.join(CACHE_DIR, 'cefrj-vocab.csv');
const OCTANOVE = path.join(CACHE_DIR, 'octanove-c1c2.csv');

const WORD_RE = /^[a-z][a-z'-]{1,23}$/;
const LEVELS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);

/** 极简 CSV 行解析：支持双引号包裹字段（内嵌逗号） */
function parseCsvLine(line) {
  const fields = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      fields.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields;
}

/** 读 CSV（跳过表头），返回对象数组 */
function readCsv(file) {
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) continue;
    const fields = parseCsvLine(line);
    const row = {};
    header.forEach((h, idx) => {
      row[h] = (fields[idx] ?? '').trim();
    });
    rows.push(row);
  }
  return rows;
}

function main() {
  if (!fs.existsSync(CEFRJ) || !fs.existsSync(OCTANOVE)) {
    console.error('[words] 缺少词表缓存，请先运行 legacy 的 build-dataset（legacy/scripts/.cache/）');
    process.exit(1);
  }
  if (!fs.existsSync(DB_PATH)) {
    console.error('[words] 找不到数据库，请先 npm run import:data && npm run build:dict');
    process.exit(1);
  }

  const db = new Database(DB_PATH);
  const hasDict = db
    .prepare(`SELECT COUNT(*) AS c FROM sqlite_master WHERE type='table' AND name='word_dict'`)
    .get().c;
  if (!hasDict) {
    console.error('[words] word_dict 表不存在，请先运行 npm run build:dict');
    process.exit(1);
  }

  // word -> level / pos（后出现的更高级词表覆盖：CEFR-J 优先，C1/C2 补空）
  const levels = new Map();
  const posMap = new Map();

  const mark = (headword, pos, level) => {
    if (!LEVELS.has(level)) return;
    // 词条可能用 / 分隔同义词形：a.m./A.M./am/AM
    for (let form of headword.split('/')) {
      form = form.trim().toLowerCase().replace(/\s+/g, '');
      if (!WORD_RE.test(form)) continue;
      if (!levels.has(form)) {
        levels.set(form, level);
        posMap.set(form, pos || '');
      }
    }
  };

  for (const row of readCsv(CEFRJ)) mark(row.headword, row.pos, (row.CEFR || '').toUpperCase());
  for (const row of readCsv(OCTANOVE)) mark(row.headword, row.pos, (row.CEFR || '').toUpperCase());

  // 只保留 word_dict 里有释义的原形词
  const lookup = db.prepare(
    `SELECT word FROM word_dict WHERE word = ? AND translation <> '' AND inf_of = ''`
  );
  const rows = [];
  for (const [word, level] of levels) {
    if (!lookup.get(word)) continue;
    rows.push({ word, level, pos: posMap.get(word) || '' });
  }

  db.exec(`
    DROP TABLE IF EXISTS word_cefr;
    CREATE TABLE word_cefr (
      word  TEXT PRIMARY KEY,
      level TEXT NOT NULL,
      pos   TEXT NOT NULL DEFAULT ''
    );
  `);
  const insert = db.prepare(`INSERT OR IGNORE INTO word_cefr (word, level, pos) VALUES (?, ?, ?)`);
  db.transaction(() => rows.forEach((r) => insert.run(r.word, r.level, r.pos)))();

  const stats = db
    .prepare(`SELECT level, COUNT(*) AS c FROM word_cefr GROUP BY level ORDER BY level`)
    .all();
  const total = db.prepare(`SELECT COUNT(*) AS c FROM word_cefr`).get().c;
  db.close();

  const dist = stats.map((s) => `${s.level}:${s.c}`).join('  ');
  console.log(`[words] 词库总计：${total} 词（${dist}）`);
  console.log(`[words] 写入完成 → ${DB_PATH} (word_cefr)`);
}

main();

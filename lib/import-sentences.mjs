/**
 * import-sentences.mjs
 * 一次性脚本：把旧版的 sentences.js / sentences.tatoeba.js 导入 SQLite。
 * 运行：node lib/import-sentences.mjs
 */
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const DB_PATH = process.env.DICTATION_DB_PATH || path.join(__dirname, '..', 'data', 'dictation.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/* schema */
db.exec(`
  CREATE TABLE IF NOT EXISTS datasets (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, source TEXT NOT NULL, description TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
  CREATE TABLE IF NOT EXISTS sentences (
    id TEXT PRIMARY KEY, dataset_id TEXT NOT NULL, level TEXT NOT NULL, category TEXT NOT NULL,
    text TEXT NOT NULL, zh TEXT, blanks TEXT, source TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(dataset_id) REFERENCES datasets(id)
  );
  CREATE TABLE IF NOT EXISTS practice_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT, sentence_id TEXT NOT NULL, dataset_id TEXT NOT NULL,
    mode TEXT NOT NULL, correct INTEGER NOT NULL, mistakes INTEGER NOT NULL DEFAULT 0,
    time_spent INTEGER NOT NULL DEFAULT 0, typed_text TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(sentence_id) REFERENCES sentences(id)
  );
  CREATE TABLE IF NOT EXISTS sentence_stats (
    sentence_id TEXT PRIMARY KEY, total_attempts INTEGER NOT NULL DEFAULT 0,
    correct_count INTEGER NOT NULL DEFAULT 0, last_attempt_at TEXT, next_review_at TEXT,
    FOREIGN KEY(sentence_id) REFERENCES sentences(id)
  );
  CREATE INDEX IF NOT EXISTS idx_sentences_dataset ON sentences(dataset_id);
  CREATE INDEX IF NOT EXISTS idx_sentences_level ON sentences(level);
  CREATE INDEX IF NOT EXISTS idx_sentences_category ON sentences(category);
  CREATE INDEX IF NOT EXISTS idx_records_sentence ON practice_records(sentence_id);
  CREATE INDEX IF NOT EXISTS idx_records_created ON practice_records(created_at);
`);

const stmtInsertDataset = db.prepare(
  'INSERT OR IGNORE INTO datasets (id, name, source, description) VALUES (?, ?, ?, ?)'
);
const stmtInsertSentence = db.prepare(
  `INSERT OR IGNORE INTO sentences (id, dataset_id, level, category, text, zh, blanks, source)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);

function normalize(s) {
  return {
    id: s.id, level: s.level, category: s.category, text: s.text,
    zh: s.zh || null, blanks: s.blanks ? JSON.stringify(s.blanks) : null, source: s.source || null,
  };
}

function importSentences(sentences, datasetId, datasetName, datasetSource, description) {
  const insertDataset = db.transaction(() => {
    stmtInsertDataset.run(datasetId, datasetName, datasetSource, description || '');
    sentences.forEach((s) => {
      stmtInsertSentence.run(
        s.id, datasetId, s.level, s.category, s.text, s.zh, s.blanks, s.source
      );
    });
  });
  insertDataset();
  return { datasetId, count: sentences.length };
}

// 加载旧语料（模拟 window 环境）
global.window = {};
require('../legacy/data/sentences.js');
const builtInData = global.window.APP_DATA;

global.window = {};
require('../legacy/data/sentences.tatoeba.js');
const tatoebaData = global.window.TATOEBA_DATA;

const builtInSentences = builtInData.sentences.map(normalize);
const tatoebaSentences = tatoebaData.sentences.map(normalize);

const r1 = importSentences(builtInSentences, 'builtin', '内置精选语料', 'builtin', '人工整理的 126 句精选例句，覆盖 CEFR A1–C2');
const r2 = importSentences(tatoebaSentences, 'tatoeba', 'Tatoeba 开源语料库', 'tatoeba', 'Tatoeba 英↔中句对，等级由 CEFR-J/Octanove 词表估计');

console.log('导入完成：', r1, r2);
db.close();
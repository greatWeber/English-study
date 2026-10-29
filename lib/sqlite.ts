import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH = process.env.DICTATION_DB_PATH || path.join(process.cwd(), 'data', 'dictation.db');

// 确保 data 目录存在
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

/* ============================================================ schema */

db.exec(`
  CREATE TABLE IF NOT EXISTS datasets (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    source      TEXT NOT NULL,
    description TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS sentences (
    id          TEXT PRIMARY KEY,
    dataset_id  TEXT NOT NULL,
    level       TEXT NOT NULL,
    category    TEXT NOT NULL,
    text        TEXT NOT NULL,
    zh          TEXT,
    blanks      TEXT,   -- JSON: 指定挖空词数组，空则自动挖空
    source      TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(dataset_id) REFERENCES datasets(id)
  );

  CREATE TABLE IF NOT EXISTS practice_records (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    sentence_id   TEXT NOT NULL,
    dataset_id    TEXT NOT NULL,
    mode          TEXT NOT NULL,        -- 'fill' | 'dictation'
    correct       INTEGER NOT NULL,     -- 0/1
    mistakes      INTEGER NOT NULL DEFAULT 0,
    time_spent    INTEGER NOT NULL DEFAULT 0,  -- 秒
    typed_text    TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY(sentence_id) REFERENCES sentences(id)
  );

  CREATE TABLE IF NOT EXISTS sentence_stats (
    sentence_id      TEXT PRIMARY KEY,
    total_attempts   INTEGER NOT NULL DEFAULT 0,
    correct_count    INTEGER NOT NULL DEFAULT 0,
    last_attempt_at  TEXT,
    next_review_at   TEXT,
    FOREIGN KEY(sentence_id) REFERENCES sentences(id)
  );

  CREATE INDEX IF NOT EXISTS idx_sentences_dataset ON sentences(dataset_id);
  CREATE INDEX IF NOT EXISTS idx_sentences_level ON sentences(level);
  CREATE INDEX IF NOT EXISTS idx_sentences_category ON sentences(category);
  CREATE INDEX IF NOT EXISTS idx_records_sentence ON practice_records(sentence_id);
  CREATE INDEX IF NOT EXISTS idx_records_created ON practice_records(created_at);
`);

/* ============================================================ helpers */

const stmtInsertDataset = db.prepare(
  'INSERT OR IGNORE INTO datasets (id, name, source, description) VALUES (?, ?, ?, ?)'
);
const stmtInsertSentence = db.prepare(
  `INSERT OR IGNORE INTO sentences (id, dataset_id, level, category, text, zh, blanks, source)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
);
const stmtUpsertStats = db.prepare(
  `INSERT INTO sentence_stats (sentence_id, total_attempts, correct_count, last_attempt_at, next_review_at)
   VALUES (?, 1, ?, datetime('now'), ?)
   ON CONFLICT(sentence_id) DO UPDATE SET
     total_attempts = total_attempts + 1,
     correct_count = correct_count + ?,
     last_attempt_at = datetime('now'),
     next_review_at = ?`
);

/** 把内置 JS 语料导入 SQLite（首次运行调用） */
export function importSentences(sentences: Array<{
  id: string;
  level: string;
  category: string;
  text: string;
  zh?: string;
  blanks?: string[];
  source?: string;
}>, datasetId: string, datasetName: string, datasetSource: string, description?: string) {
  const insertDataset = db.transaction(() => {
    stmtInsertDataset.run(datasetId, datasetName, datasetSource, description ?? '');
    sentences.forEach((s) => {
      stmtInsertSentence.run(
        s.id,
        datasetId,
        s.level,
        s.category,
        s.text,
        s.zh ?? null,
        s.blanks ? JSON.stringify(s.blanks) : null,
        s.source ?? null
      );
    });
  });
  insertDataset();
  return { datasetId, count: sentences.length };
}

/** 获取所有数据集及句子数 */
export function listDatasets() {
  return db.prepare(
    `SELECT d.id, d.name, d.source, d.description, d.created_at,
            COUNT(s.id) AS sentence_count
     FROM datasets d
     LEFT JOIN sentences s ON s.dataset_id = d.id
     GROUP BY d.id
     ORDER BY d.created_at DESC`
    ).all();
}

/** 按条件获取句子（用于练习抽题） */
export function listSentences({
  datasetId,
  level,
  category,
  limit = 20,
  excludeMastered = false,
}: {
  datasetId?: string;
  level?: string;
  category?: string;
  limit?: number;
  excludeMastered?: boolean;
}) {
  let sql = `
    SELECT s.id, s.dataset_id, s.level, s.category, s.text, s.zh, s.blanks, s.source,
           st.total_attempts, st.correct_count, st.next_review_at
    FROM sentences s
    LEFT JOIN sentence_stats st ON st.sentence_id = s.id
    WHERE 1=1
  `;
  const params: Array<string | number> = [];

  if (datasetId) {
    sql += ` AND s.dataset_id = ?`;
    params.push(datasetId);
  }
  if (level) {
    sql += ` AND s.level = ?`;
    params.push(level);
  }
  if (category) {
    sql += ` AND s.category = ?`;
    params.push(category);
  }

  if (excludeMastered) {
    // 已掌握（连对 3 次）的不再出现，除非到复习时间
    sql += ` AND (
              st.total_attempts IS NULL
              OR st.correct_count < 3
              OR (st.next_review_at IS NOT NULL AND datetime(st.next_review_at) <= datetime('now'))
            )`;
  }

  sql += ` ORDER BY RANDOM() LIMIT ?`;
  params.push(limit);

  return db.prepare(sql).all(params);
}

/** 保存一次做题记录，并更新句子统计/复习时间 */
export function saveRecord({
  sentenceId,
  datasetId,
  mode,
  correct,
  mistakes,
  timeSpent,
  typedText,
}: {
  sentenceId: string;
  datasetId: string;
  mode: string;
  correct: boolean;
  mistakes: number;
  timeSpent: number;
  typedText: string;
}) {
  const insertRecord = db.transaction(() => {
    db.prepare(
      `INSERT INTO practice_records (sentence_id, dataset_id, mode, correct, mistakes, time_spent, typed_text)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(sentenceId, datasetId, mode, correct ? 1 : 0, mistakes, timeSpent, typedText);

    // 计算下次复习时间（错误则 1 小时后复习，正确则按连对数递增）
    const row = db.prepare('SELECT total_attempts, correct_count FROM sentence_stats WHERE sentence_id = ?').get(sentenceId) as {
      total_attempts: number;
      correct_count: number;
    } | undefined;
    const correctCount = row ? row.correct_count + (correct ? 1 : 0) : (correct ? 1 : 0);
    const total = (row ? row.total_attempts : 0) + 1;

    let nextReview = null;
    if (!correct) {
      // 错了：1 小时后复习
      nextReview = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    } else if (correctCount >= 3) {
      // 连对 3 次：视为掌握，暂不复习（除非用户主动要求）
      nextReview = null;
    } else {
      // 正确但未达连对：按简单间隔（此处简化为不立即重复，留给后续算法）
      nextReview = null;
    }

    stmtUpsertStats.run(sentenceId, correct ? 1 : 0, nextReview, correct ? 1 : 0, nextReview);
  });
  insertRecord();
}

/** 获取需要复习的句子（错题率高或到复习时间） */
export function getReviewSentences(limit = 20) {
  return db.prepare(
    `SELECT s.id, s.dataset_id, s.level, s.category, s.text, s.zh, s.blanks, s.source,
           st.total_attempts, st.correct_count,
           ROUND(100.0 * st.correct_count / NULLIF(st.total_attempts, 0), 1) AS accuracy
     FROM sentence_stats st
     JOIN sentences s ON s.id = st.sentence_id
     WHERE st.total_attempts >= 2
       AND (st.correct_count * 1.0 / st.total_attempts) < 0.7
       AND (st.next_review_at IS NULL OR datetime(st.next_review_at) <= datetime('now'))
     ORDER BY accuracy ASC, st.total_attempts DESC
     LIMIT ?`
  ).all(limit);
}

/** 获取总体统计 */
export function getOverviewStats() {
  const totalRecords = db.prepare('SELECT COUNT(*) AS c FROM practice_records').get() as { c: number };
  const correctRecords = db.prepare("SELECT COUNT(*) AS c FROM practice_records WHERE correct = 1").get() as { c: number };
  const distinctSentences = db.prepare('SELECT COUNT(DISTINCT sentence_id) AS c FROM practice_records').get() as { c: number };
  const avgAccuracy = db.prepare(
    'SELECT ROUND(100.0 * SUM(correct) / COUNT(*), 1) AS acc FROM practice_records'
  ).get() as { acc: number | null };
  return {
    totalAttempts: totalRecords.c,
    totalCorrect: correctRecords.c,
    accuracy: avgAccuracy.acc ?? 0,
    distinctSentencesPracticed: distinctSentences.c,
  };
}

/** 关闭数据库（用于测试/退出） */
export function close() {
  db.close();
}

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

  -- 近义替换复核缓存：同一个空 + 同一个学生答案只推理一次
  CREATE TABLE IF NOT EXISTS word_records (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    word       TEXT NOT NULL,
    typed      TEXT NOT NULL DEFAULT '',
    correct    INTEGER NOT NULL DEFAULT 0,  -- 严格正确
    lenient    INTEGER NOT NULL DEFAULT 0,  -- 拼写变体/typo（算半对）
    time_spent INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS answer_equivalence (
    sentence_id TEXT NOT NULL,
    blank_order INTEGER NOT NULL,
    typed       TEXT NOT NULL,
    expected    TEXT NOT NULL,
    accepted    INTEGER NOT NULL,   -- 0/1
    entail      REAL,
    contra      REAL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (sentence_id, blank_order, typed)
  );

  CREATE INDEX IF NOT EXISTS idx_sentences_dataset ON sentences(dataset_id);
  CREATE INDEX IF NOT EXISTS idx_sentences_level ON sentences(level);
  CREATE INDEX IF NOT EXISTS idx_sentences_category ON sentences(category);
  CREATE INDEX IF NOT EXISTS idx_records_sentence ON practice_records(sentence_id);
  CREATE INDEX IF NOT EXISTS idx_records_created ON practice_records(created_at);
  CREATE INDEX IF NOT EXISTS idx_word_records_word ON word_records(word);
  CREATE INDEX IF NOT EXISTS idx_word_records_created ON word_records(created_at);
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
  ids,
}: {
  datasetId?: string;
  level?: string;
  category?: string;
  limit?: number;
  excludeMastered?: boolean;
  /** 指定句子 id（复习本「重练这一句」用），给了就只返回这些 */
  ids?: string[];
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

  // 指定 id 时忽略随机排序，按给定顺序返回（复习本单句重练）
  if (ids && ids.length) {
    const ph = ids.map(() => '?').join(',');
    sql += ` AND s.id IN (${ph})`;
    params.push(...ids);
    const order = ` CASE s.id ${ids
      .map((_, i) => `WHEN ? THEN ${i}`)
      .join(' ')} ELSE ${ids.length} END`;
    sql += ` ORDER BY${order} LIMIT ?`;
    params.push(...ids, ids.length);
    return db.prepare(sql).all(params);
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
      // 错了：立即进入复习本，首页的待复习入口马上可见
      nextReview = new Date().toISOString();
    } else if (correctCount >= 3) {
      // 连对 3 次：视为掌握，暂不复习（除非用户主动要求）
      nextReview = null;
    } else {
      // 正确但未达连对：明天再复习一次
      nextReview = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    }

    stmtUpsertStats.run(sentenceId, correct ? 1 : 0, nextReview, correct ? 1 : 0, nextReview);
  });
  insertRecord();
}

/** 获取需要复习的句子：第一次答错就能进入复习本 */
export function getReviewSentences(limit = 20) {
  return db.prepare(
    `SELECT s.id, s.dataset_id, s.level, s.category, s.text, s.zh, s.blanks, s.source,
           st.total_attempts, st.correct_count,
           ROUND(100.0 * st.correct_count / NULLIF(st.total_attempts, 0), 1) AS accuracy
     FROM sentence_stats st
     JOIN sentences s ON s.id = st.sentence_id
     WHERE st.total_attempts >= 1
       AND (st.correct_count * 1.0 / st.total_attempts) < 0.7
     ORDER BY accuracy ASC, st.total_attempts DESC
     LIMIT ?`
  ).all(limit);
}

/** 复习本句子数量（首页待复习入口用） */
export function countReviewSentences() {
  const row = db.prepare(
    `SELECT COUNT(*) AS c
     FROM sentence_stats st
     WHERE st.total_attempts >= 1
       AND (st.correct_count * 1.0 / st.total_attempts) < 0.7`
  ).get() as { c: number };
  return Number(row.c) || 0;
}

/** 清空句子练习记录与统计 */
export function clearSentenceRecords() {
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM practice_records').get() as { c: number };
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM practice_records').run();
    db.prepare('DELETE FROM sentence_stats').run();
  });
  tx();
  return { deleted: c };
}

/** 清空单词练习记录 */
export function clearWordRecords() {
  const { c } = db.prepare('SELECT COUNT(*) AS c FROM word_records').get() as { c: number };
  db.prepare('DELETE FROM word_records').run();
  return { deleted: c };
}

/** 清空全部练习记录（兼容旧入口） */
export function clearAllRecords() {
  const sentences = clearSentenceRecords();
  const words = clearWordRecords();
  return { deleted: sentences.deleted + words.deleted };
}

/** 获取总体统计（句子 + 单词） */
export function getOverviewStats() {
  const row = db.prepare(
    `SELECT COUNT(*) AS attempts,
            COALESCE(SUM(correct), 0) AS correct
     FROM (
       SELECT correct FROM practice_records
       UNION ALL
       SELECT correct FROM word_records
     )`
  ).get() as { attempts: number; correct: number };
  const distinctSentences = db.prepare(
    'SELECT COUNT(DISTINCT sentence_id) AS c FROM practice_records'
  ).get() as { c: number };
  return {
    totalAttempts: Number(row.attempts) || 0,
    totalCorrect: Number(row.correct) || 0,
    accuracy: row.attempts > 0 ? Math.round((row.correct / row.attempts) * 1000) / 10 : 0,
    distinctSentencesPracticed: Number(distinctSentences.c) || 0,
  };
}

/* ============================================================ 首页学习面板 */

function localDateKey(date: Date) {
  return date.toLocaleDateString('en-CA');
}

/** 聚合首页需要的连续天数、今日进度、待复习数量和近 7 天趋势 */
export function getDashboardStats() {
  const todayRow = db.prepare(
    `SELECT
       (SELECT COUNT(*) FROM practice_records
         WHERE date(created_at, 'localtime') = date('now', 'localtime')) +
       (SELECT COUNT(*) FROM word_records
         WHERE date(created_at, 'localtime') = date('now', 'localtime')) AS attempts,
       (SELECT COALESCE(SUM(correct), 0) FROM practice_records
         WHERE date(created_at, 'localtime') = date('now', 'localtime')) +
       (SELECT COALESCE(SUM(correct), 0) FROM word_records
         WHERE date(created_at, 'localtime') = date('now', 'localtime')) AS correct`
  ).get() as { attempts: number; correct: number };

  const total = getOverviewStats();

  const activeDays = db.prepare(
    `SELECT DISTINCT d FROM (
       SELECT date(created_at, 'localtime') AS d FROM practice_records
       UNION ALL
       SELECT date(created_at, 'localtime') AS d FROM word_records
     )
     WHERE d IS NOT NULL
     ORDER BY d DESC
     LIMIT 400`
  ).all() as Array<{ d: string }>;
  const daySet = new Set(activeDays.map((row) => row.d));
  let streak = 0;
  const cursor = new Date();
  if (!daySet.has(localDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }
  while (daySet.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  const recentRows = db.prepare(
    `SELECT d, COUNT(*) AS attempts, COALESCE(SUM(correct), 0) AS correct
     FROM (
       SELECT date(created_at, 'localtime') AS d, correct FROM practice_records
       UNION ALL
       SELECT date(created_at, 'localtime') AS d, correct FROM word_records
     )
     WHERE d IS NOT NULL
     GROUP BY d
     ORDER BY d DESC
     LIMIT 7`
  ).all() as Array<{ d: string; attempts: number; correct: number }>;
  const recentMap = new Map(recentRows.map((row) => [row.d, row]));
  const last7Days: Array<{ date: string; attempts: number; correct: number }> = [];
  for (let i = 6; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = localDateKey(date);
    const row = recentMap.get(key);
    last7Days.push({
      date: key,
      attempts: Number(row?.attempts) || 0,
      correct: Number(row?.correct) || 0,
    });
  }

  return {
    streak,
    today: {
      attempts: Number(todayRow.attempts) || 0,
      correct: Number(todayRow.correct) || 0,
      accuracy:
        todayRow.attempts > 0
          ? Math.round((todayRow.correct / todayRow.attempts) * 100)
          : 0,
    },
    review: {
      sentences: countReviewSentences(),
      words: countWordReview(),
    },
    total,
    last7Days,
  };
}

/* ============================================================ 近义替换缓存 */

/** 读取某个空的复核缓存（按 句子 + 空序 + 学生答案 命中） */
export function getEquivalence(sentenceId: string, blankOrder: number, typed: string) {
  return db
    .prepare(
      `SELECT accepted, entail, contra FROM answer_equivalence
       WHERE sentence_id = ? AND blank_order = ? AND typed = ?`,
    )
    .get(sentenceId, blankOrder, typed) as
    | { accepted: number; entail: number | null; contra: number | null }
    | undefined;
}

/** 写入/更新复核缓存 */
export function saveEquivalence({
  sentenceId,
  blankOrder,
  typed,
  expected,
  accepted,
  entail,
  contra,
}: {
  sentenceId: string;
  blankOrder: number;
  typed: string;
  expected: string;
  accepted: boolean;
  entail: number;
  contra: number;
}) {
  db.prepare(
    `INSERT INTO answer_equivalence (sentence_id, blank_order, typed, expected, accepted, entail, contra)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(sentence_id, blank_order, typed) DO UPDATE SET
       accepted = excluded.accepted,
       entail = excluded.entail,
       contra = excluded.contra`,
  ).run(sentenceId, blankOrder, typed, expected, accepted ? 1 : 0, entail, contra);
}

/* ============================================================ 离线单词词典 */

/** 按小写词形精确查一条词典记录（word_dict 由 npm run build:dict 生成） */
export function getDictEntry(word: string) {
  return db
    .prepare(
      `SELECT word, phonetic, translation, definition, pos, collins, oxford, tag, inf_of, inf_label
       FROM word_dict WHERE word = ?`,
    )
    .get(word) as
    | {
        word: string;
        phonetic: string;
        translation: string;
        definition: string;
        pos: string;
        collins: number;
        oxford: number;
        tag: string;
        inf_of: string;
        inf_label: string;
      }
    | undefined;
}

/** 批量保存单词默写作答记录，返回写入条数 */
export function saveWordRecords(
  items: Array<{ word: string; typed: string; correct: boolean; lenient: boolean; timeSpent: number }>
) {
  const stmt = db.prepare(
    `INSERT INTO word_records (word, typed, correct, lenient, time_spent) VALUES (?, ?, ?, ?, ?)`
  );
  const run = db.transaction(() => {
    let n = 0;
    for (const it of items) {
      if (!it.word) continue;
      stmt.run(it.word, it.typed, it.correct ? 1 : 0, it.lenient ? 1 : 0, it.timeSpent);
      n += 1;
    }
    return n;
  });
  return run();
}

/** 单词默写抽题：按等级 / 考试词表从 word_cefr 取词，联 word_dict 带出音标/释义 */
/** 词库总量（可按等级、考试标签过滤），首页徽标用 */
export function countWordBank(level: string, exam = ''): number {
  const where: string[] = [];
  const params: string[] = [];
  if (level && level !== 'all') {
    where.push('w.level = ?');
    params.push(level);
  }
  if (exam) {
    where.push("(' ' || d.tag || ' ') LIKE ?");
    params.push(`% ${exam} %`);
  }
  const sql = `SELECT COUNT(*) AS n FROM word_cefr w JOIN word_dict d ON d.word = w.word${
    where.length ? ` WHERE ${where.join(' AND ')}` : ''
  }`;
  const row = db.prepare(sql).get(...params);
  return Number((row as { n: number }).n) || 0;
}

export function getWordQuiz(
  level: string,
  count: number,
  exam = '',
  ids?: string[]
) {
  const where: string[] = [];
  const params: unknown[] = [];
  if (level && level !== 'all') {
    where.push('w.level = ?');
    params.push(level);
  }
  if (exam) {
    where.push("(' ' || d.tag || ' ') LIKE ?");
    params.push(`% ${exam} %`);
  }
  if (ids && ids.length > 0) {
    where.push(`w.word IN (${ids.map(() => '?').join(',')})`);
    params.push(...ids);
  }

  const orderBy =
    ids && ids.length > 0
      ? `ORDER BY CASE w.word ${ids.map((_, index) => `WHEN ? THEN ${index}`).join(' ')} ELSE ${ids.length} END`
      : 'ORDER BY RANDOM()';
  const orderParams = ids && ids.length > 0 ? ids : [];
  const limit = ids && ids.length > 0 ? ids.length : count;
  const rows = db
    .prepare(
      `SELECT w.word, w.level, w.pos, d.phonetic, d.translation, d.inf_of, d.inf_label
         FROM word_cefr w
         JOIN word_dict d ON d.word = w.word
        ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
        ${orderBy}
        LIMIT ?`
    )
    .all(...params, ...orderParams, limit) as Array<{
    word: string;
    level: string;
    pos: string;
    phonetic: string;
    translation: string;
    inf_of: string;
    inf_label: string;
  }>;
  return rows;
}

/** 单词复习列表：答错未掌握的词（正确次数 < 3） */
export function getWordReview(limit = 50) {
  return db.prepare(
    `WITH agg AS (
       SELECT word,
              COUNT(*) AS total_attempts,
              SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) AS correct_count,
              SUM(CASE WHEN correct = 0 THEN 1 ELSE 0 END) AS wrong_count,
              ROUND(100.0 * SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS accuracy,
              MAX(created_at) AS last_attempt_at
       FROM word_records
       GROUP BY word
     ),
     last AS (
       SELECT r.word, r.correct AS last_correct
       FROM word_records r
       WHERE r.id = (SELECT MAX(r2.id) FROM word_records r2 WHERE r2.word = r.word)
     )
     SELECT a.word, a.total_attempts, a.correct_count, a.wrong_count, a.accuracy,
            a.last_attempt_at, d.phonetic, d.translation, w.level
     FROM agg a
     JOIN last l ON l.word = a.word
     JOIN word_dict d ON d.word = a.word
     LEFT JOIN word_cefr w ON w.word = a.word
     WHERE a.correct_count < 3
       AND (l.last_correct = 0 OR a.accuracy < 70)
     ORDER BY a.accuracy ASC, a.last_attempt_at DESC
     LIMIT ?`
  ).all(limit) as Array<{
    word: string;
    total_attempts: number;
    correct_count: number;
    wrong_count: number;
    accuracy: number;
    last_attempt_at: string;
    phonetic: string;
    translation: string;
    level: string | null;
  }>;
}

/** 待复习单词数量 */
export function countWordReview() {
  const row = db.prepare(
    `WITH agg AS (
       SELECT word,
              SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) AS correct_count,
              ROUND(100.0 * SUM(CASE WHEN correct = 1 THEN 1 ELSE 0 END) / COUNT(*), 1) AS accuracy
       FROM word_records
       GROUP BY word
     ),
     last AS (
       SELECT r.word, r.correct AS last_correct
       FROM word_records r
       WHERE r.id = (SELECT MAX(r2.id) FROM word_records r2 WHERE r2.word = r.word)
     )
     SELECT COUNT(*) AS c
     FROM agg a
     JOIN last l ON l.word = a.word
     WHERE a.correct_count < 3
       AND (l.last_correct = 0 OR a.accuracy < 70)`
  ).get() as { c: number };
  return Number(row.c) || 0;
}

/** 关闭数据库（用于测试/退出） */
export function close() {
  db.close();
}

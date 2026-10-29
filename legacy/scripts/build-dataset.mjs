#!/usr/bin/env node
/**
 * build-dataset.mjs — 用开源语料生成更大的题库：data/sentences.tatoeba.js
 *
 * 数据来源（全部开源，详见 README「语料来源」一节）：
 *   1. Tatoeba 英文句子            https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2
 *   2. Tatoeba 中文（简/繁）句子    https://downloads.tatoeba.org/exports/per_language/cmn/cmn_sentences.tsv.bz2
 *   3. Tatoeba 句子链接（英↔中）    https://downloads.tatoeba.org/exports/links.tar.bz2   （约 150MB，会缓存）
 *   4. CEFR-J Vocabulary Profile v1.5 + Octanove C1/C2  用于判定句子等级
 *
 * 用法：
 *   node scripts/build-dataset.mjs                     # 生成约 3000 条
 *   node scripts/build-dataset.mjs --limit=8000        # 生成更多
 *   node scripts/build-dataset.mjs --no-download       # 只用缓存里的数据
 *   TATOEBA_CACHE=/tmp/tatoeba node scripts/build-dataset.mjs
 *
 * 生成的文件被 index.html 自动识别（app.js 会尝试加载它），
 * 之后页面顶部的「语料库」下拉框里就能切换。
 *
 * 需要：Node 18+，以及系统里的 bunzip2 / tar（macOS、Linux 自带）。
 */
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { spawn } from 'node:child_process';
import { Readable } from 'node:stream';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const Engine = require('../assets/js/engine.js');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = process.env.TATOEBA_CACHE || path.join(ROOT, 'scripts', '.cache');
const OUT = path.join(ROOT, 'data', 'sentences.tatoeba.js');
const TAXONOMY = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'taxonomy.json'), 'utf8'));

const args = process.argv.slice(2);
const opt = {
  limit: 3000,
  minWords: 4,
  maxWords: 14,
  maxChars: 82,
  noDownload: args.includes('--no-download')
};
args.forEach((a) => {
  const m = /^--(limit|min-words|max-words|max-chars)=(\d+)$/.exec(a);
  if (!m) return;
  if (m[1] === 'limit') opt.limit = Number(m[2]);
  if (m[1] === 'min-words') opt.minWords = Number(m[2]);
  if (m[1] === 'max-words') opt.maxWords = Number(m[2]);
  if (m[1] === 'max-chars') opt.maxChars = Number(m[2]);
});

/* ---------------------------------------------------------------- 工具 */

const log = (...a) => console.log('·', ...a);
const bytes = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.round(n / 1024) + ' KB');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function download(url, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
    log('已缓存', path.basename(dest), bytes(fs.statSync(dest).size));
    return dest;
  }
  if (opt.noDownload) throw new Error('缺少缓存文件且指定了 --no-download：' + dest);
  log('下载', url);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok || !res.body) throw new Error('下载失败 ' + res.status + ' ' + url);
  const tmp = dest + '.part';
  const total = Number(res.headers.get('content-length')) || 0;
  let got = 0;
  let tick = Date.now();
  const file = fs.createWriteStream(tmp);
  const source = Readable.fromWeb(res.body);
  source.on('data', (chunk) => {
    got += chunk.length;
    if (Date.now() - tick > 2000) {
      tick = Date.now();
      const line = total ? Math.round((got / total) * 100) + '%' : bytes(got);
      process.stdout.write('\r  ' + path.basename(dest) + ' ' + line + '   ');
    }
  });
  await new Promise((ok, fail) => {
    source.pipe(file).on('finish', ok).on('error', fail);
  });
  process.stdout.write('\r' + ' '.repeat(60) + '\r');
  fs.renameSync(tmp, dest);
  return dest;
}

/** 逐行读取某个命令的 stdout（用来流式解压 bz2 / tar，不落盘） */
async function* linesOf(cmd, cmdArgs) {
  const child = spawn(cmd, cmdArgs, { stdio: ['ignore', 'pipe', 'inherit'] });
  const rl = readline.createInterface({ input: child.stdout, crlfDelay: Infinity });
  for await (const line of rl) yield line;
}

/** 从 GitHub 拉一个小文件（走 API，避免 raw.githubusercontent 被墙） */
async function githubFile(repo, file, dest) {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return dest;
  if (opt.noDownload) throw new Error('缺少缓存文件：' + dest);
  log('下载', repo + '/' + file);
  const headers = { Accept: 'application/vnd.github+json', 'User-Agent': 'english-study-build' };
  const meta = await (await fetch(`https://api.github.com/repos/${repo}/contents/${file}`, { headers })).json();
  if (!meta || !meta.sha) throw new Error('拿不到 ' + repo + '/' + file + ' 的元信息');
  const blob = await (await fetch(`https://api.github.com/repos/${repo}/git/blobs/${meta.sha}`, { headers })).json();
  if (!blob || !blob.content) throw new Error('拿不到 ' + repo + '/' + file + ' 的内容');
  fs.writeFileSync(dest, Buffer.from(blob.content, 'base64'));
  return dest;
}

/* ------------------------------------------------------- CEFR 等级词表 */

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

async function loadWordLevels() {
  const map = new Map();
  const files = [
    await githubFile('openlanguageprofiles/olp-en-cefrj', 'cefrj-vocabulary-profile-1.5.csv', path.join(CACHE, 'cefrj-vocab.csv')),
    await githubFile('openlanguageprofiles/olp-en-cefrj', 'octanove-vocabulary-profile-c1c2-1.0.csv', path.join(CACHE, 'octanove-c1c2.csv'))
  ];
  files.forEach((file) => {
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    lines.slice(1).forEach((line) => {
      if (!line.trim()) return;
      const cols = line.split(',');
      const head = cols[0];
      const level = (cols[2] || '').trim().toUpperCase();
      if (!head || LEVELS.indexOf(level) === -1) return;
      head
        .split(/[/,;]/)
        .map((w) => w.replace(/\(.*?\)/g, '').replace(/[^A-Za-z' -]/g, '').trim().toLowerCase())
        .filter((w) => w && w.length > 1 && !w.includes(' '))
        .forEach((w) => {
          const prev = map.get(w);
          if (!prev || LEVELS.indexOf(level) > LEVELS.indexOf(prev)) map.set(w, level);
        });
    });
  });
  log('CEFR 词表', map.size, '个词条');
  return map;
}

const levelIndex = (lv) => Math.max(0, LEVELS.indexOf(lv));

/** 用「句子里最难的实词」+「长度补偿」估一个 CEFR 等级 */
function estimateLevel(text, wordLevels) {
  const words = Engine.tokenize(text).filter((it) => it.kind === 'word');
  let hardest = 0;
  let unknown = 0;
  const seen = new Set();
  words.forEach((it) => {
    const w = it.text.toLowerCase();
    if (!Engine.isContentWord(w)) return;
    if (seen.has(w)) return;
    seen.add(w);
    const lv = wordLevels.get(w);
    if (lv == null) unknown += 1;
    else hardest = Math.max(hardest, levelIndex(lv));
  });

  let score = hardest;
  if (unknownRatio(seen.size, unknown) > 0.5) score += 1; // 大多不认识 → 偏难
  if (seen.size >= 8) score += 1;
  if (text.length >= 68) score += 1;
  return LEVELS[Math.min(LEVELS.length - 1, Math.max(0, score))];
}

function unknownRatio(total, unknown) {
  return total === 0 ? 0 : unknown / total;
}

/* ------------------------------------------------------------- 场景分类 */

const CATEGORY_KEYWORDS = {
  travel: ['airport','flight','train','station','ticket','passport','hotel','luggage','bag','trip','travel','journey','tourist','map','abroad','visa','boarding','bus','taxi','vacation','holiday','beach','mountain','campsite','itinerary'],
  food: ['eat','meal','breakfast','lunch','dinner','restaurant','menu','coffee','tea','bread','rice','soup','dish','cook','kitchen','recipe','hungry','thirsty','delicious','taste','dessert','fruit','vegetable','meat','cheese','drink','waiter','snack','sugar','salt'],
  shopping: ['buy','bought','shop','store','market','price','cheap','expensive','discount','sale','refund','receipt','cash','card','pay','paid','money','dollar','order','size','clothes','shirt','shoes','jacket','warranty','customer'],
  study: ['school','teacher','student','class','lesson','homework','exam','test','study','learn','book','library','university','college','professor','lecture','essay','grade','course','degree','vocabulary','grammar','research','thesis'],
  work: ['work','job','office','boss','manager','meeting','client','colleague','company','salary','deadline','report','project','interview','resume','career','promotion','colleague','team','business','marketing','engineer','staff'],
  health: ['doctor','nurse','hospital','medicine','sick','ill','pain','headache','fever','cold','flu','healthy','health','exercise','sleep','tired','injury','dentist','patient','diet','vaccine','symptom','therapy','stress'],
  social: ['friend','party','invite','birthday','wedding','hello','thanks','thank','sorry','apologize','apologise','congratulations','greet','chat','talk','conversation','relationship','neighbor','neighbour','guest','welcome','joke','laugh'],
  daily: ['home','house','room','kitchen','garden','clean','wash','laundry','morning','evening','weekend','family','mother','father','sister','brother','children','dog','cat','sleep','wake','usually','chore','weather','rain','sunny','cold']
};

function categorize(text) {
  const lower = ' ' + text.toLowerCase().replace(/[^a-z' ]/g, ' ').replace(/\s+/g, ' ') + ' ';
  let best = null;
  let bestHits = 0;
  Object.keys(CATEGORY_KEYWORDS).forEach((cat) => {
    let hits = 0;
    CATEGORY_KEYWORDS[cat].forEach((kw) => {
      if (lower.includes(' ' + kw + ' ') || lower.includes(' ' + kw + 's ')) hits += 1;
    });
    if (hits > bestHits) {
      bestHits = hits;
      best = cat;
    }
  });
  return best || 'daily';
}

/* ------------------------------------------------------------ 中文过滤 */

// 常见「繁体专用字」——出现就丢掉这条中文翻译，保证题库是简体。
const TRADITIONAL_ONLY = '們這對說學習點時麼沒後樣東車開關問間話語買賣錢覺讓聽讀寫書門馬鳥魚豬貓貴賤輕萬與興舉義議樂齊龍歲豐麼臺灣灣裡麵點鐘隻個為麼喜愛錢';

function isSimplified(text) {
  for (const ch of text) {
    if (TRADITIONAL_ONLY.includes(ch)) return false;
  }
  return /[\u4e00-\u9fff]/.test(text);
}

/* ------------------------------------------------------------ 英文过滤 */

const BANNED_NAMES = /\b(Tom|Mary|Jane|Jack|Sami|Bob|Bill|Alice|Peter|Hans|Yanni|Judy|Ken|Lucy|Huck)\b/;

function qualifies(text) {
  if (!text || !/^[\x20-\x7E]+$/.test(text)) return false;
  if (text.length < 16 || text.length > opt.maxChars) return false;
  if (!/[.!?]$/.test(text)) return false;
  if (BANNED_NAMES.test(text)) return false;
  if (/[A-Za-z]{3,}[A-Z]/.test(text)) return false; // 像是专有名词拼接
  const words = Engine.tokenize(text).filter((it) => it.kind === 'word');
  if (words.length < opt.minWords || words.length > opt.maxWords) return false;
  if (!words.some((w) => /^[a-z]/.test(w.text))) return false;
  return true;
}

/* ------------------------------------------------------------------ 主流程 */

async function main() {
  ensureDir(CACHE);
  log('缓存目录', CACHE);

  const engFile = await download(
    'https://downloads.tatoeba.org/exports/per_language/eng/eng_sentences.tsv.bz2',
    path.join(CACHE, 'eng_sentences.tsv.bz2')
  );
  const cmnFile = await download(
    'https://downloads.tatoeba.org/exports/per_language/cmn/cmn_sentences.tsv.bz2',
    path.join(CACHE, 'cmn_sentences.tsv.bz2')
  );
  const linksFile = await download(
    'https://downloads.tatoeba.org/exports/links.tar.bz2',
    path.join(CACHE, 'links.tar.bz2')
  );
  const wordLevels = await loadWordLevels();

  // 1) 中文句子：只看简体、短一点的
  const cmn = new Map();
  for await (const line of linesOf('bunzip2', ['-c', cmnFile])) {
    const at = line.indexOf('\t');
    if (at < 0) continue;
    const at2 = line.indexOf('\t', at + 1);
    if (at2 < 0) continue;
    const id = line.slice(0, at);
    const text = line.slice(at2 + 1);
    if (text.length > 60 || !isSimplified(text)) continue;
    cmn.set(id, text);
  }
  log('中文句子', cmn.size, '条（已过滤繁体）');

  // 2) 英文句子：先过滤，只留合规矩的
  const eng = new Map();
  for await (const line of linesOf('bunzip2', ['-c', engFile])) {
    const at = line.indexOf('\t');
    if (at < 0) continue;
    const at2 = line.indexOf('\t', at + 1);
    if (at2 < 0) continue;
    const id = line.slice(0, at);
    const text = line.slice(at2 + 1);
    if (!qualifies(text)) continue;
    eng.set(id, text);
  }
  log('候选英文句子', eng.size, '条');

  // 3) 从 links.tar.bz2 里流式挑出「英文 ↔ 中文」的配对
  const pair = new Map(); // engId -> cmnId
  let scanned = 0;
  for await (const line of linesOf('tar', ['-xjOf', linksFile])) {
    if (line === 'links.csv' || line.startsWith('links.csv')) continue;
    const at = line.indexOf('\t');
    if (at < 0) continue;
    const a = line.slice(0, at);
    const b = line.slice(at + 1);
    scanned += 1;
    const aEng = eng.has(a);
    const bEng = eng.has(b);
    if (aEng && cmn.has(b)) pair.set(a, b);
    else if (bEng && cmn.has(a)) pair.set(b, a);
  }
  log('扫描链接', scanned.toLocaleString(), '条，配对成功', pair.size.toLocaleString(), '对');

  // 4) 组装题目
  const seen = new Set();
  const byLevel = new Map(LEVELS.map((lv) => [lv, []]));
  let n = 0;
  for (const [engId, cmnId] of pair) {
    const text = eng.get(engId);
    const zh = cmn.get(cmnId);
    const key = text.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim();
    if (seen.has(key)) continue;
    seen.add(key);
    const level = estimateLevel(text, wordLevels);
    const item = {
      id: 'tat-' + engId,
      level,
      category: categorize(text),
      text,
      zh,
      source: 'tatoeba'
    };
    byLevel.get(level).push(item);
    n += 1;
  }

  // 5) 各等级均匀取样，避免全是某一档
  const perLevel = Math.max(50, Math.ceil(opt.limit / LEVELS.length));
  const picked = [];
  LEVELS.forEach((lv) => {
    const list = Engine.shuffle(byLevel.get(lv)).slice(0, perLevel);
    list.forEach((item) => picked.push(item));
  });
  picked.sort((a, b) => (a.level < b.level ? -1 : a.level > b.level ? 1 : a.text.length - b.text.length));

  log('共生成', picked.length, '题');
  const stat = {};
  picked.forEach((p) => {
    stat[p.level] = stat[p.level] || {};
    stat[p.level][p.category] = (stat[p.level][p.category] || 0) + 1;
  });
  LEVELS.forEach((lv) => {
    const cats = Object.keys(stat[lv] || {})
      .map((c) => c + ':' + stat[lv][c])
      .join(' ');
    console.log('   ' + lv + '  ' + cats);
  });

  // 6) 写文件
  const head = [
    '/*!',
    ' * sentences.tatoeba.js — 由 scripts/build-dataset.mjs 自动生成，请勿手改。',
    ' *',
    ' * 语料来源：Tatoeba（英↔中句对）。Tatoeba 句子主要采用 CC BY 2.0 FR 许可，',
    ' * 部分句子为 CC0（公有领域）。等级为启发式估计，场景为关键词匹配结果。',
    ' *',
    ' * 生成时间：' + new Date().toISOString(),
    ' * 题目数量：' + picked.length,
    ' */',
    'window.TATOEBA_DATA = {',
    '  version: 1,',
    '  updated: ' + JSON.stringify(new Date().toISOString().slice(0, 10)) + ',',
    '  name: "Tatoeba 语料库（' + picked.length + ' 题）",',
    '  license: "Tatoeba CC BY 2.0 FR / CC0",',
    '  levels: ' + JSON.stringify(TAXONOMY.levels) + ',',
    '  categories: ' + JSON.stringify(TAXONOMY.categories) + ',',
    '  sentences: ['
  ].join('\n');
  const body = picked.map((s) => '    ' + JSON.stringify(s)).join(',\n');
  fs.writeFileSync(OUT, head + '\n' + body + '\n  ]\n};\n');

  log('写入', path.relative(ROOT, OUT), bytes(fs.statSync(OUT).size));
  log('打开 index.html 就能在顶部「语料库」里切换了。');
}

main().catch((err) => {
  console.error('\n构建失败：' + err.message);
  process.exit(1);
});

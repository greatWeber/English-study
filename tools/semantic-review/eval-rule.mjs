/**
 * 回归测评：用「生产规则」跑一遍全部案例
 *
 * 生产规则 = ① 拼写闸门 looksLikeTypo  ② 同音词表  ③ NLI 阈值 0.95 / 短词 0.99 / contra<0.1
 *
 * 注意：下面的 editDistance / looksLikeTypo 必须与 lib/utils.ts 保持一致
 *（那边是 TS，无法被 .mjs 直接 import）。改动时同步两处。
 *
 *   node tools/semantic-review/eval-rule.mjs
 */
import { AutoTokenizer, AutoModelForSequenceClassification, env } from '@huggingface/transformers';
import { PAIRS } from './pairs.mjs';

env.remoteHost = process.env.HF_ENDPOINT || 'https://hf-mirror.com';
env.remotePathTemplate = '{model}/resolve/{revision}/';
env.allowLocalModels = true;
env.useFSCache = true;

const MODEL = process.env.NLI_MODEL || 'Xenova/nli-deberta-v3-xsmall';
const MIN_ENTAIL = 0.95;
const MIN_ENTAIL_SHORT = 0.98;
const MAX_CONTRA = 0.1;

/* ---------- 与 lib/utils.ts 同步的拼写闸门 ---------- */
function editDistance(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}
const norm = (w) => String(w).toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z']/g, '');
function looksLikeTypo(expected, typed) {
  const x = norm(expected), y = norm(typed);
  if (!x || !y || x === y) return false;
  const dist = editDistance(x, y);
  if (dist === 0) return false;
  return dist <= 2 && dist / Math.max(x.length, y.length) <= 0.34;
}
/* ---------- 与 lib/utils.ts 同步的英美拼写规则（只需覆盖测评集里的 colour/color） ---------- */
function spellingVariant(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y || x === y) return false;
  const rules = [
    [/our\b/, 'or'], [/or\b/, 'our'], [/ise\b/, 'ize'], [/ize\b/, 'ise'],
    [/re\b/, 'er'], [/er\b/, 're'],
  ];
  return rules.some(([re, rep]) => x.replace(re, rep) === y);
}
/* -------------------------------------------------- */

/* ---------- 与 lib/utils.ts 同步的词形（lemma）检查 ---------- */
const INFLECTION_BASE = {
  men: 'man', women: 'woman', children: 'child', teeth: 'tooth', feet: 'foot',
  geese: 'goose', mice: 'mouse', people: 'person', leaves: 'leaf', knives: 'knife',
  wives: 'wife', wolves: 'wolf', lives: 'life', halves: 'half', shelves: 'shelf',
  thieves: 'thief', cacti: 'cactus', fungi: 'fungus', analyses: 'analysis',
  crises: 'crisis', theses: 'thesis', phenomena: 'phenomenon', media: 'medium',
  am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be', being: 'be',
  has: 'have', had: 'have', having: 'have',
  does: 'do', did: 'do', done: 'do', doing: 'do',
  goes: 'go', went: 'go', gone: 'go', going: 'go',
  says: 'say', said: 'say',
  better: 'good', best: 'good', worse: 'bad', worst: 'bad',
};
const SUFFIX_RULES = [
  [/ies$/, 'y'], [/ied$/, 'y'], [/ier$/, 'y'], [/iest$/, 'y'],
  [/ying$/, 'ie'], [/ily$/, 'y'],
  [/([^aeiou])\1(?:ing|ed|er|est|s)$/, '$1'],
  [/ing$/, ''], [/ing$/, 'e'], [/ed$/, ''], [/ed$/, 'e'],
  [/es$/, ''], [/s$/, ''], [/er$/, ''], [/est$/, ''], [/ly$/, ''], [/i$/, 'y'],
];
const dedupeTail = (s) => s.replace(/([^aeiou])\1$/, '$1');
function lemmaCandidates(word) {
  const start = norm(word);
  const seen = new Set();
  const out = [];
  if (!start) return out;
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift();
    if (seen.has(cur)) continue;
    seen.add(cur);
    out.push(cur);
    const ir = INFLECTION_BASE[cur];
    if (ir && !seen.has(ir)) queue.push(ir);
    for (const [re, rep] of SUFFIX_RULES) {
      if (!re.test(cur)) continue;
      const cand = dedupeTail(cur.replace(re, rep));
      if (cand.length >= 2 && !seen.has(cand)) queue.push(cand);
    }
  }
  return out;
}
function reductionDistance(from, to) {
  if (from.length < to.length) return Infinity;
  const max = from.length - to.length;
  if (max > 3) return Infinity;
  return editDistance(from, to);
}
function sameLemma(a, b) {
  const x = norm(a), y = norm(b);
  if (!x || !y || x === y) return false;
  const xs = lemmaCandidates(x), ys = lemmaCandidates(y);
  for (const cx of xs) {
    for (const cy of ys) {
      if (cx === cy) {
        if (Math.abs(x.length - y.length) <= 3) return true;
        continue;
      }
      if (reductionDistance(cx, cy) <= 1 || reductionDistance(cy, cx) <= 1) return true;
    }
  }
  return false;
}
/* -------------------------------------------------- */

const CONFUSABLE = [['their', 'there'], ['affect', 'effect']];
const isConfusable = (a, b) => {
  const x = norm(a), y = norm(b);
  return CONFUSABLE.some(([p, q]) => (x === p && y === q) || (x === q && y === p));
};

function substitute(sentence, expected, typed) {
  const re = new RegExp(`\\b${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
  return sentence.replace(re, typed);
}
function softmax(arr) {
  const m = Math.max(...arr);
  const ex = arr.map((x) => Math.exp(x - m));
  const s = ex.reduce((a, b) => a + b, 0);
  return ex.map((x) => x / s);
}

/** 拼写错误集：label 'neq'（必须判错），来自 typo-probe 实测 */
const TYPOS = [
  { sentence: 'What a wonderful family.', zh: '多美好的家庭啊！', expected: 'wonderful', typed: 'wondefull', label: 'neq' },
  { sentence: 'What a wonderful family they are!', zh: '他们是一多美好的家庭啊！', expected: 'wonderful', typed: 'wondeful', label: 'neq' },
  { sentence: 'What a wonderful family they are!', zh: '多美好的家庭啊！', expected: 'family', typed: 'famliy', label: 'neq' },
  { sentence: 'I want to ride a bicycle to school.', zh: '我想骑车去上学。', expected: 'bicycle', typed: 'bicyle', label: 'neq' },
  { sentence: 'I want to ride a bicycle to school.', zh: '我想骑车去上学。', expected: 'bicycle', typed: 'bicycel', label: 'neq' },
  { sentence: 'She is a clever student.', zh: '她是个聪明的学生。', expected: 'clever', typed: 'cleever', label: 'neq' },
  { sentence: 'I want to ride a bicycle to school.', zh: '我想骑车去上学。', expected: 'bicycle', typed: 'bkie', label: 'neq' },
  { sentence: 'What a wonderful family they are!', zh: '多美好的家庭啊！', expected: 'wonderful', typed: 'greta', label: 'neq' },
];

/** 词形错误：语义通顺但形式不对，必须判错（NLI 实测 7/8 会给 entail≥0.95） */
const FORM_ERRORS = [
  { sentence: 'I like sheep.', zh: '我喜欢羊。', expected: 'sheep', typed: 'sheeps', label: 'neq' },
  { sentence: 'There are five child in the room.', zh: '房间里有五个孩子。', expected: 'child', typed: 'childs', label: 'neq' },
  { sentence: 'She go to school every day.', zh: '她每天去上学。', expected: 'go', typed: 'goes', label: 'neq' },
  { sentence: 'I see a mice in the kitchen.', zh: '我看见一只老鼠。', expected: 'mice', typed: 'mouse', label: 'neq' },
  { sentence: 'He is more tall than his brother.', zh: '他比他哥哥高。', expected: 'tall', typed: 'taller', label: 'neq' },
  { sentence: 'There are many informations online.', zh: '网上有很多信息。', expected: 'informations', typed: 'information', label: 'neq' },
  { sentence: 'She is a good singer.', zh: '她是个好歌手。', expected: 'singer', typed: 'singing', label: 'neq' },
  { sentence: 'I like animals.', zh: '我喜欢动物。', expected: 'animals', typed: 'animate', label: 'neq' },
];

/** 完整复刻 lib/semanticJudge.ts + checkBlanks 的判定链 */
async function productionJudge(c, model, tokenizer, iE, iC) {
  // checkBlanks 阶段
  const exact = norm(c.typed) === norm(c.expected);
  if (exact) return { correct: true, via: 'exact' };
  if (spellingVariant(c.expected, c.typed)) return { correct: true, via: 'spelling' };
  if (looksLikeTypo(c.expected, c.typed)) return { correct: false, via: 'typo-gate' };

  // /api/judge 阶段（顺序必须和 semanticJudge.ts 一致）
  if (isConfusable(c.expected, c.typed)) return { correct: false, via: 'confusable' };
  if (sameLemma(c.expected, c.typed)) return { correct: false, via: 'form-gate' };
  const hypothesis = substitute(c.sentence, c.expected, c.typed);
  if (hypothesis === c.sentence) return { correct: false, via: 'no-substitution' };

  const inputs = tokenizer(c.sentence, { text_pair: hypothesis });
  const probs = softmax((await model(inputs)).logits.tolist()[0]);
  const entail = probs[iE], contra = probs[iC];
  const need = norm(c.typed).length <= 3 ? MIN_ENTAIL_SHORT : MIN_ENTAIL;
  const accept = entail >= need && contra < MAX_CONTRA;
  return {
    correct: accept,
    via: accept ? 'semantic' : 'low',
    entail,
    contra,
  };
}

(async () => {
  console.log(`[加载] ${MODEL} ...`);
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL);
  const model = await AutoModelForSequenceClassification.from_pretrained(MODEL, { dtype: 'q8' });
  const id2label = model.config?.id2label || {};
  const iE = Number(Object.entries(id2label).find(([, l]) => String(l).includes('entail'))?.[0] ?? 1);
  const iC = Number(Object.entries(id2label).find(([, l]) => String(l).includes('contra'))?.[0] ?? 0);

  console.log(
    `\n规则: 拼写闸门(dist≤2 且 ratio≤0.34) → 同音词表 → NLI(entail≥${MIN_ENTAIL}` +
      `, 短词 ${MIN_ENTAIL_SHORT}, contra<${MAX_CONTRA})\n`,
  );

  const groups = [
    { name: '同义词/等价（应判对）', items: PAIRS.filter((p) => p.label === 'eq') },
    { name: '语义不等价（应判错）', items: PAIRS.filter((p) => p.label === 'neq') },
    { name: '拼写错误（应判错）', items: TYPOS },
    { name: '词形错误（应判错）', items: FORM_ERRORS },
  ];

  let totalOk = 0, totalN = 0;
  for (const g of groups) {
    console.log(`【${g.name}】`);
    let ok = 0;
    for (const c of g.items) {
      const r = await productionJudge(c, model, tokenizer, iE, iC);
      const want = c.label === 'eq';
      const hit = r.correct === want;
      if (hit) ok++;
      const score = r.entail !== undefined ? ` entail=${r.entail.toFixed(3)}` : '';
      console.log(
        `  ${hit ? '✓' : '✗'} ${c.expected} → ${c.typed}`.padEnd(32) +
          ` ${r.correct ? '判对' : '判错'}`.padEnd(8) + ` [${r.via}]${score}`,
      );
    }
    console.log(`  → ${ok}/${g.items.length}\n`);
    totalOk += ok;
    totalN += g.items.length;
  }

  console.log('='.repeat(60));
  console.log(`  总准确率: ${totalOk}/${totalN} = ${((totalOk / totalN) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

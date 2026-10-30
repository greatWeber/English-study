/**
 * 探针：NLI 对「拼写错误」到底有多不敏感？
 *
 * 关键假设：句子越长、上下文越多，单个拼写错误被忽略得越厉害
 * （因为 6 个词里有 5 个完全相同 → 整句几乎等价 → entailment 飙高）。
 *
 *   node tools/semantic-review/typo-probe.mjs
 */
import { AutoTokenizer, AutoModelForSequenceClassification, env } from '@huggingface/transformers';

env.remoteHost = process.env.HF_ENDPOINT || 'https://hf-mirror.com';
env.remotePathTemplate = '{model}/resolve/{revision}/';
env.allowLocalModels = true;
env.useFSCache = true;

const MODEL = 'Xenova/nli-deberta-v3-xsmall';

/** 同一个词，放进从短到长的句子里，看 entail 怎么变 */
const CONTEXTS = [
  { sentence: 'What a wonderful family!', expected: 'wonderful', typed: 'wondefull' },
  { sentence: 'What a wonderful family they are!', expected: 'wonderful', typed: 'wondefull' },
  {
    sentence: 'What a wonderful family they have, I really admire them.',
    expected: 'wonderful',
    typed: 'wondefull',
  },
  {
    sentence:
      'After meeting his parents and his three sisters, I had to admit what a wonderful family they are.',
    expected: 'wonderful',
    typed: 'wondefull',
  },
];

/** 各种 typo，都用较长的自然句子 */
const TYPOS = [
  { sentence: 'What a wonderful family they are!', expected: 'wonderful', typed: 'wondeful' },
  { sentence: 'What a wonderful family they are!', expected: 'family', typed: 'famliy' },
  { sentence: 'I want to ride a bicycle to school.', expected: 'bicycle', typed: 'bicyle' },
  { sentence: 'I want to ride a bicycle to school.', expected: 'bicycle', typed: 'bicycel' },
  { sentence: 'She is a clever student in our class.', expected: 'clever', typed: 'cleever' },
  { sentence: 'He went to the shop to buy some milk.', expected: 'shop', typed: 'shppo' },
];

/** 对照组：真同义词（应该接受）+ 拼错的同义词（不该接受） */
const CONTROLS = [
  { sentence: 'I want to ride a bicycle to school.', expected: 'bicycle', typed: 'bike' },
  { sentence: 'I want to ride a bicycle to school.', expected: 'bicycle', typed: 'bkie' },
  { sentence: 'What a wonderful family they are!', expected: 'wonderful', typed: 'great' },
  { sentence: 'What a wonderful family they are!', expected: 'wonderful', typed: 'greta' },
];

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
  }
  return dp[m][n];
}

const norm = (w) => w.toLowerCase().replace(/[^a-z']/g, '');

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

/** 生产代码 lib/semanticJudge.ts 的接受规则 */
function currentRule(entail, contra, typed) {
  const need = typed.length <= 3 ? 0.99 : 0.9;
  return entail >= need && contra < 0.1;
}

/** 建议新增的拼写闸门：和标准答案只差 1~2 个字母 ⇒ 判为拼写错误 */
function looksLikeTypo(expected, typed) {
  const a = norm(expected), b = norm(typed);
  if (!a || !b) return false;
  const dist = levenshtein(a, b);
  return dist > 0 && dist <= Math.max(1, Math.floor(a.length / 4));
}

let iE = 1, iC = 0;
let model, tokenizer;

async function score(c) {
  const hypothesis = substitute(c.sentence, c.expected, c.typed);
  const inputs = tokenizer(c.sentence, { text_pair: hypothesis });
  const probs = softmax((await model(inputs)).logits.tolist()[0]);
  return { entail: probs[iE], contra: probs[iC] };
}

function line(c, entail, contra) {
  const accept = currentRule(entail, contra, c.typed);
  const typo = looksLikeTypo(c.expected, c.typed);
  const dist = levenshtein(norm(c.expected), norm(c.typed));
  console.log(
    `  ${c.expected} → ${c.typed}`.padEnd(26) +
      ` entail=${entail.toFixed(4)} contra=${contra.toFixed(4)}` +
      `  编辑距离=${dist}` +
      `  现规则=${accept ? '✅接受' : '❌拒绝'}` +
      `  拼写闸门=${typo ? '🚫拦' : '放行'}`,
  );
  return { accept, typo };
}

(async () => {
  tokenizer = await AutoTokenizer.from_pretrained(MODEL);
  model = await AutoModelForSequenceClassification.from_pretrained(MODEL, { dtype: 'q8' });
  const id2label = model.config?.id2label || {};
  iE = Number(Object.entries(id2label).find(([, l]) => String(l).includes('entail'))?.[0] ?? 1);
  iC = Number(Object.entries(id2label).find(([, l]) => String(l).includes('contra'))?.[0] ?? 0);

  console.log('\n【一】同一个拼写错误，句子越长 → entail 越高？');
  let wrongInLong = 0;
  for (const c of CONTEXTS) {
    const { entail, contra } = await score(c);
    const nWords = c.sentence.split(/\s+/).length;
    const { accept } = line({ ...c }, entail, contra);
    console.log(`      （整句 ${nWords} 个词）${accept ? '  ← 被误判为正确！' : ''}`);
    if (accept) wrongInLong++;
  }

  console.log('\n【二】其它常见拼写错误（自然句子）');
  let typoAccepted = 0;
  for (const c of TYPOS) {
    const { entail, contra } = await score(c);
    const { accept, typo } = line(c, entail, contra);
    if (accept) typoAccepted++;
    if (typo && accept) console.log('      ↑ 拼写错误却被判对（闸门本可拦下）');
  }

  console.log('\n【三】对照组：真同义词 vs 拼错的同义词');
  for (const c of CONTROLS) {
    const { entail, contra } = await score(c);
    line(c, entail, contra);
  }

  console.log(`\n${'='.repeat(66)}`);
  console.log(`  长句中被误判为正确: ${wrongInLong} / ${CONTEXTS.length}`);
  console.log(`  拼写错误被误判为正确: ${typoAccepted} / ${TYPOS.length}`);
  console.log(`${'='.repeat(66)}\n`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

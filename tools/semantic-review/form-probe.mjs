/**
 * 探针：NLI 对「词形错误」（单复数 / 时态 / 比较级 / 词性）是否敏感？
 *
 * 假设：和拼写错误一样，NLI 只管语义不管词形，这类会照样给高分。
 * 如果证实，就得在 NLI 之前加一层「词形一致性」检查。
 *
 *   node tools/semantic-review/form-probe.mjs
 */
import { AutoTokenizer, AutoModelForSequenceClassification, env } from '@huggingface/transformers';

env.remoteHost = process.env.HF_ENDPOINT || 'https://hf-mirror.com';
env.remotePathTemplate = '{model}/resolve/{revision}/';
env.allowLocalModels = true;
env.useFSCache = true;

const MODEL = process.env.NLI_MODEL || 'Xenova/nli-deberta-v3-xsmall';

/** 词形错误：语义通顺，但语法形式不对，应当判错 */
const FORM_ERRORS = [
  { sentence: 'I like sheep.', expected: 'sheep', typed: 'sheeps', label: 'neq', note: '不可数/单复同形加了 s' },
  { sentence: 'There are five child in the room.', expected: 'child', typed: 'childs', label: 'neq', note: '规则化错误的复数' },
  { sentence: 'She go to school every day.', expected: 'go', typed: 'goes', label: 'neq', note: '第三人称单数' },
  { sentence: 'I see a mice in the kitchen.', expected: 'mice', typed: 'mouse', label: 'neq', note: '不规则复数写反' },
  { sentence: 'He is more tall than his brother.', expected: 'tall', typed: 'taller', label: 'neq', note: '比较级叠用' },
  { sentence: 'There are many informations online.', expected: 'informations', typed: 'information', label: 'neq', note: '不可数名词' },
  { sentence: 'I have two foot.', expected: 'foot', typed: 'feet', label: 'neq', note: '不规则复数（这个其实是对的？用来测模型）' },
  { sentence: 'She is a good singer.', expected: 'singer', typed: 'singing', label: 'neq', note: '词性变化' },
];

/** 真同义替换（都应接受），用于对比 */
const OK = [
  { sentence: 'I like sheep.', expected: 'sheep', typed: 'lamb', label: 'eq', note: '近义（羊/羔羊）' },
  { sentence: 'She is a clever student.', expected: 'clever', typed: 'smart', label: 'eq', note: '真同义' },
];

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
function editDistance(a, b) {
  const m = a.length, n = b.length;
  const d = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[m][n];
}

(async () => {
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL);
  const model = await AutoModelForSequenceClassification.from_pretrained(MODEL, { dtype: 'q8' });
  const id2label = model.config?.id2label || {};
  const iE = Number(Object.entries(id2label).find(([, l]) => String(l).includes('entail'))?.[0] ?? 1);
  const iC = Number(Object.entries(id2label).find(([, l]) => String(l).includes('contra'))?.[0] ?? 0);

  const rows = [];
  for (const c of [...FORM_ERRORS, ...OK]) {
    const hypothesis = substitute(c.sentence, c.expected, c.typed);
    const inputs = tokenizer(c.sentence, { text_pair: hypothesis });
    const p = softmax((await model(inputs)).logits.tolist()[0]);
    rows.push({ ...c, entail: p[iE], contra: p[iC], dist: editDistance(c.expected, c.typed) });
  }

  console.log('\n【词形错误】语义通顺但语法形式不对 —— 应判错\n');
  let leak = 0;
  for (const r of rows.filter((r) => r.label === 'neq')) {
    const pass = r.entail >= 0.95 && r.contra < 0.1;
    if (pass) leak++;
    console.log(
      `  ${r.expected} → ${r.typed}`.padEnd(28) +
        ` entail=${r.entail.toFixed(4)} contra=${r.contra.toFixed(4)}` +
        ` dist=${r.dist}` +
        `  ${pass ? '⚠️  ≥0.95 会被放过' : '✓ 被阈值拦住'}`,
    );
    console.log(`      ${r.note}`);
  }

  console.log('\n【真同义替换】—— 应判对\n');
  for (const r of rows.filter((r) => r.label === 'eq')) {
    const pass = r.entail >= 0.95;
    console.log(
      `  ${r.expected} → ${r.typed}`.padEnd(28) +
        ` entail=${r.entail.toFixed(4)} dist=${r.dist}` +
        `  ${pass ? '✓ 接受' : '✗ 被拒'}`,
    );
  }

  console.log(`\n${'='.repeat(62)}`);
  console.log(`  词形错误中 entail≥0.95（会被误判为正确）: ${leak} / ${FORM_ERRORS.length}`);
  console.log('='.repeat(62) + '\n');
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

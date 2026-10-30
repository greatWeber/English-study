/**
 * 离线「同义/等价判定」POC —— 对比三条本地路线
 *   A) 句向量相似度：Xenova/all-MiniLM-L6-v2 (bi-encoder)
 *   B) 小 LLM 判官：onnx-community/Qwen3-0.6B-ONNX (instruct, 约束式 YES/NO)
 *   C) NLI 蕴含模型：Xenova/nli-deberta-v3-xsmall / -small (cross-encoder)
 *
 * 全部通过 @huggingface/transformers (Transformers.js) 在本机 CPU 上跑，无需任何外部服务。
 * 国内网络：默认走 hf-mirror.com（可用 HF_ENDPOINT 覆盖）。
 *
 * 用法：
 *   node tools/semantic-review/poc.mjs --model=all
 *   node tools/semantic-review/poc.mjs --model=minilm
 *   node tools/semantic-review/poc.mjs --model=qwen
 *   node tools/semantic-review/poc.mjs --model=nli [--nli-model=xsmall|small]
 */

import {
  pipeline,
  env,
  AutoTokenizer,
  AutoModelForSequenceClassification,
} from '@huggingface/transformers';
import { PAIRS } from './pairs.mjs';

// ---- 网络：国内镜像 ----
env.remoteHost = process.env.HF_ENDPOINT || 'https://hf-mirror.com';
env.remotePathTemplate = '{model}/resolve/{revision}/';
env.allowLocalModels = true;
env.useFSCache = true;

// ---- CLI ----
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const m = a.match(/^--([^=]+)(?:=(.*))?$/);
    return m ? [m[1], m[2] ?? 'true'] : [a, 'true'];
  }),
);
const WHICH = args.model || 'all';
const NLI_SIZE = args['nli-model'] || 'xsmall';
const FIXED_THRESHOLD = Number(args.threshold || 0.8);

// ---- 工具 ----
const normalize = (w) => w.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z]/g, '');

/** 把整句里的 expected 原词（整词、忽略大小写）换成 typed，构造「学生写的句子」 */
function substitute(sentence, expected, typed) {
  const re = new RegExp(`\\b${expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
  return sentence.replace(re, typed);
}

function cosine(a, b) {
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot; // 已 L2 归一化
}

function softmax(arr) {
  const m = Math.max(...arr);
  const ex = arr.map((x) => Math.exp(x - m));
  const s = ex.reduce((a, b) => a + b, 0);
  return ex.map((x) => x / s);
}

/** 在给定阈值下按 label 评准确率，返回 { acc, tp, tn, fp, fn } */
function evalThreshold(items, threshold) {
  let tp = 0, tn = 0, fp = 0, fn = 0;
  for (const it of items) {
    const predEq = it.score >= threshold;
    const truthEq = it.label === 'eq';
    if (predEq && truthEq) tp++;
    else if (!predEq && !truthEq) tn++;
    else if (predEq && !truthEq) fp++;
    else fn++;
  }
  const acc = (tp + tn) / items.length;
  return { acc, tp, tn, fp, fn };
}

function bestThreshold(items, lo = 0.3, hi = 0.98, step = 0.02) {
  let best = null;
  for (let t = lo; t <= hi + 1e-9; t += step) {
    const r = evalThreshold(items, t);
    if (!best || r.acc > best.acc) best = { threshold: t, ...r };
  }
  return best;
}

function report(title, items, opts = {}) {
  const lo = opts.lo ?? 0.3, hi = opts.hi ?? 0.98, step = opts.step ?? 0.02;
  const fixed = opts.fixed ?? FIXED_THRESHOLD;
  const best = bestThreshold(items, lo, hi, step);
  const at = evalThreshold(items, fixed);
  console.log(`\n${'='.repeat(60)}\n${title}\n${'='.repeat(60)}`);
  for (const it of items) {
    const tag = it.label === 'eq' ? '应判对' : '应判错';
    console.log(
      `  [${tag}] ${it.expected} → ${it.typed}`.padEnd(34) + ` score=${it.score.toFixed(3)}`,
    );
  }
  console.log(
    `\n  固定阈值 ${fixed}: 准确率 ${(at.acc * 100).toFixed(1)}%  ` +
      `(TP=${at.tp} TN=${at.tn} FP=${at.fp} FN=${at.fn})`,
  );
  console.log(
    `  最佳阈值 ${best.threshold.toFixed(2)}: 准确率 ${(best.acc * 100).toFixed(1)}%  ` +
      `(TP=${best.tp} TN=${best.tn} FP=${best.fp} FN=${best.fn})`,
  );
  console.log(`  (FP=把错的判对/过度接受, FN=把对的判错/过于严格)`);
  return { fixed: at, best };
}

// ==================================================================
// A) MiniLM 句向量
// ==================================================================
async function runMiniLM() {
  console.log('\n[加载] Xenova/all-MiniLM-L6-v2 ...');
  const t0 = Date.now();
  const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
    dtype: 'q8',
  });
  console.log(`[就绪] MiniLM ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const wordTexts = [];
  const ctxPairs = [];
  for (const p of PAIRS) {
    wordTexts.push(p.expected, p.typed);
    ctxPairs.push(p.sentence, substitute(p.sentence, p.expected, p.typed));
  }

  const embWords = (await extractor(wordTexts, { pooling: 'mean', normalize: true })).tolist();
  const embCtx = (await extractor(ctxPairs, { pooling: 'mean', normalize: true })).tolist();

  const wordItems = PAIRS.map((p, i) => ({
    ...p,
    score: cosine(embWords[i * 2], embWords[i * 2 + 1]),
  }));
  const ctxItems = PAIRS.map((p, i) => ({
    ...p,
    score: cosine(embCtx[i * 2], embCtx[i * 2 + 1]),
  }));

  const r1 = report('路线 A1 — MiniLM 裸词相似度 (cosine)', wordItems);
  const r2 = report('路线 A2 — MiniLM 整句语境相似度 (cosine)', ctxItems);
  return { word: r1, ctx: r2 };
}

// ==================================================================
// B) Qwen3-0.6B 判官
// ==================================================================
const JUDGE_SYSTEM = `You are a strict but fair English answer checker for a Chinese learner.
Decide ONLY whether the student's word can replace the target word in the given sentence
without changing the intended meaning. Accept synonyms, and US/UK spelling variants
(e.g. colour/color), but reject words with a different or opposite meaning.
Answer with exactly one word: YES or NO.
/no_think`;

const JUDGE_FEWSHOT = [
  {
    role: 'user',
    content:
      'SENTENCE: I want to ride a bicycle to school.\nCHINESE: 我想骑车去上学。\n' +
      'TARGET WORD: bicycle\nSTUDENT ANSWER: car\nIs the student answer acceptable here?',
  },
  { role: 'assistant', content: 'NO' },
  {
    role: 'user',
    content:
      'SENTENCE: They live in a big house.\nCHINESE: 他们住在一栋大房子里。\n' +
      'TARGET WORD: big\nSTUDENT ANSWER: large\nIs the student answer acceptable here?',
  },
  { role: 'assistant', content: 'YES' },
  {
    role: 'user',
    content:
      'SENTENCE: He is very happy today.\nCHINESE: 他今天非常开心。\n' +
      'TARGET WORD: happy\nSTUDENT ANSWER: sad\nIs the student answer acceptable here?',
  },
  { role: 'assistant', content: 'NO' },
];

const CLOSE_THINK = '<' + '/think' + '>';
const OPEN_THINK = '<' + 'think' + '>';

function stripThinking(s) {
  let t = String(s);
  t = t.replace(new RegExp(OPEN_THINK + '[\\s\\S]*?' + CLOSE_THINK, 'gi'), '');
  if (t.includes(CLOSE_THINK)) t = t.split(CLOSE_THINK).pop();
  t = t.replace(new RegExp('<' + '/?' + 'think' + '[^>]*>', 'gi'), '');
  return t;
}

function parseYesNo(text) {
  const t = stripThinking(text || '').trim();
  const first = t.split(/\s+/)[0]?.replace(/[^A-Za-z]/g, '').toUpperCase();
  if (first === 'YES' || first === 'NO') return first;
  const m = t.match(/\b(YES|NO)\b/i);
  return m ? m[1].toUpperCase() : '?';
}

async function runQwen() {
  const MODEL = 'onnx-community/Qwen3-0.6B-ONNX';
  console.log('\n[加载] Qwen3-0.6B-ONNX (q4) ... 首次会下载模型');
  const t0 = Date.now();
  const generator = await pipeline('text-generation', MODEL, { dtype: 'q4' });
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL);
  console.log(`[就绪] Qwen3-0.6B ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const items = [];
  let totalMs = 0;
  for (const p of PAIRS) {
    const messages = [
      { role: 'system', content: JUDGE_SYSTEM },
      ...JUDGE_FEWSHOT,
      {
        role: 'user',
        content:
          `SENTENCE: ${p.sentence}\nCHINESE: ${p.zh}\n` +
          `TARGET WORD: ${p.expected}\nSTUDENT ANSWER: ${p.typed}\n` +
          `Is the student answer acceptable here?`,
      },
    ];
    const prompt = tokenizer.apply_chat_template(messages, {
      tokenize: false,
      add_generation_prompt: true,
      enable_thinking: false,
    });
    const ts = Date.now();
    const out = await generator(prompt, { max_new_tokens: 16, do_sample: false });
    totalMs += Date.now() - ts;

    const full = String(out[0].generated_text);
    const marker = full.lastIndexOf('assistant');
    const rawReply = marker >= 0 ? full.slice(marker + 'assistant'.length) : full;
    const reply = stripThinking(rawReply).trim();
    const verdict = parseYesNo(reply);
    items.push({ ...p, reply, verdict, score: verdict === 'YES' ? 1 : 0 });
  }

  let tp = 0, tn = 0, fp = 0, fn = 0, unknown = 0;
  for (const it of items) {
    if (it.verdict === '?') unknown++;
    if (it.score === 1 && it.label === 'eq') tp++;
    else if (it.score === 0 && it.label === 'neq') tn++;
    else if (it.score === 1 && it.label === 'neq') fp++;
    else fn++;
  }
  const acc = (tp + tn) / items.length;

  console.log(`\n${'='.repeat(60)}\n路线 B — Qwen3-0.6B 判官 (YES/NO)\n${'='.repeat(60)}`);
  for (const it of items) {
    const tag = it.label === 'eq' ? '应判对' : '应判错';
    const hit = (it.score === 1) === (it.label === 'eq') ? '✓' : '✗';
    console.log(`  ${hit} [${tag}] ${it.expected} → ${it.typed}`.padEnd(36) + ` judge=${it.reply}`);
  }
  console.log(
    `\n  准确率 ${(acc * 100).toFixed(1)}%  (TP=${tp} TN=${tn} FP=${fp} FN=${fn}` +
      `${unknown ? `, 无法解析=${unknown}` : ''})`,
  );
  console.log(`  平均耗时 ${(totalMs / items.length).toFixed(0)} ms/题（CPU）`);
  return { acc, tp, tn, fp, fn, avgMs: totalMs / items.length };
}

// ==================================================================
// C) NLI 蕴含 cross-encoder
// ==================================================================
async function runNLI() {
  const MODEL =
    NLI_SIZE === 'small' ? 'Xenova/nli-deberta-v3-small' : 'Xenova/nli-deberta-v3-xsmall';
  console.log(`\n[加载] ${MODEL} (q8) ...`);
  const t0 = Date.now();
  const tokenizer = await AutoTokenizer.from_pretrained(MODEL);
  const model = await AutoModelForSequenceClassification.from_pretrained(MODEL, { dtype: 'q8' });
  console.log(`[就绪] ${MODEL} ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  const id2label = model.config?.id2label || {};
  const idxOf = (kw, fb) => {
    for (const [i, l] of Object.entries(id2label)) {
      if (String(l).toLowerCase().includes(kw)) return Number(i);
    }
    return fb;
  };
  const iE = idxOf('entail', 2);
  const iC = idxOf('contra', 0);
  console.log(`  labels=${JSON.stringify(id2label)}  ⇒ entail#${iE} contra#${iC}`);

  const items = [];
  let totalMs = 0;
  for (const p of PAIRS) {
    const premise = p.sentence;
    const hypothesis = substitute(p.sentence, p.expected, p.typed);
    const inputs = tokenizer(premise, { text_pair: hypothesis });
    const ts = Date.now();
    const out = await model(inputs);
    totalMs += Date.now() - ts;
    const probs = softmax(out.logits.tolist()[0]);
    const entail = probs[iE];
    const contra = probs[iC];
    items.push({ ...p, entail, contra, score: entail, scoreDiff: entail - contra });
  }

  const r1 = report('路线 C1 — NLI 蕴含概率 P(entailment)', items);
  const r2 = report(
    '路线 C2 — NLI 蕴含-矛盾差值 P(entail)-P(contra)',
    items.map((it) => ({ ...it, score: it.scoreDiff })),
    { lo: -0.8, hi: 0.9, step: 0.02, fixed: 0.5 },
  );
  console.log(`  平均耗时 ${(totalMs / items.length).toFixed(0)} ms/题（CPU）`);
  return { entail: r1, diff: r2 };
}

// ==================================================================
// main
// ==================================================================
(async () => {
  console.log(
    `测评集：${PAIRS.length} 条（正例 ${PAIRS.filter((p) => p.label === 'eq').length} / ` +
      `反例 ${PAIRS.filter((p) => p.label === 'neq').length}）`,
  );
  console.log(`镜像：${env.remoteHost}`);

  const results = {};
  if (WHICH === 'all' || WHICH === 'minilm') {
    try {
      results.minilm = await runMiniLM();
    } catch (e) {
      console.error('[MiniLM 失败]', e?.message || e);
    }
  }
  if (WHICH === 'all' || WHICH === 'nli') {
    try {
      results.nli = await runNLI();
    } catch (e) {
      console.error('[NLI 失败]', e?.message || e);
    }
  }
  if (WHICH === 'all' || WHICH === 'qwen') {
    try {
      results.qwen = await runQwen();
    } catch (e) {
      console.error('[Qwen 失败]', e?.message || e);
    }
  }

  console.log(`\n${'='.repeat(60)}\n汇总\n${'='.repeat(60)}`);
  if (results.minilm) {
    console.log(
      `  MiniLM 裸词   最佳阈值 ${results.minilm.word.best.threshold.toFixed(2)} → ` +
        `${(results.minilm.word.best.acc * 100).toFixed(1)}%`,
    );
    console.log(
      `  MiniLM 语境   最佳阈值 ${results.minilm.ctx.best.threshold.toFixed(2)} → ` +
        `${(results.minilm.ctx.best.acc * 100).toFixed(1)}%`,
    );
  }
  if (results.qwen) {
    console.log(
      `  Qwen3-0.6B 判官 → ${(results.qwen.acc * 100).toFixed(1)}%  ` +
        `(${results.qwen.avgMs.toFixed(0)} ms/题)`,
    );
  }
  if (results.nli) {
    console.log(
      `  NLI 蕴含概率   最佳阈值 ${results.nli.entail.best.threshold.toFixed(2)} → ` +
        `${(results.nli.entail.best.acc * 100).toFixed(1)}%`,
    );
    console.log(
      `  NLI 蕴含-矛盾  最佳阈值 ${results.nli.diff.best.threshold.toFixed(2)} → ` +
        `${(results.nli.diff.best.acc * 100).toFixed(1)}%`,
    );
  }
})().catch((e) => {
  console.error('运行出错：', e);
  process.exit(1);
});

/**
 * 探针：验证 Qwen3 的 chat template / enable_thinking 是否正确应用
 * 目的：解释为什么原 POC 里判官几乎全说 YES（怀疑 messages 数组没走 chat template）
 */
import { pipeline, env, AutoTokenizer } from '@huggingface/transformers';
import { PAIRS } from './pairs.mjs';

env.remoteHost = process.env.HF_ENDPOINT || 'https://hf-mirror.com';
env.remotePathTemplate = '{model}/resolve/{revision}/';
env.allowLocalModels = true;
env.useFSCache = true;

const MODEL = 'onnx-community/Qwen3-0.6B-ONNX';

const SYSTEM = `You are a strict but fair English answer checker for a Chinese learner.
Decide ONLY whether the student's word can replace the target word in the given sentence
without changing the intended meaning. Accept synonyms, and US/UK spelling variants
(e.g. colour/color), but reject words with different or opposite meaning.
Answer with exactly one word: YES or NO.`;

const FEWSHOT = [
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
];

const msgsFor = (p) => [
  { role: 'system', content: SYSTEM },
  ...FEWSHOT,
  {
    role: 'user',
    content:
      `SENTENCE: ${p.sentence}\nCHINESE: ${p.zh}\n` +
      `TARGET WORD: ${p.expected}\nSTUDENT ANSWER: ${p.typed}\n` +
      `Is the student answer acceptable here?`,
  },
];

const tok = await AutoTokenizer.from_pretrained(MODEL);

const tpl = (enable_thinking) =>
  tok.apply_chat_template(msgsFor(PAIRS[0]), {
    tokenize: false,
    add_generation_prompt: true,
    enable_thinking,
  });

console.log('=========== 模板渲染 enable_thinking=false（末尾）===========');
console.log(JSON.stringify(tpl(false).slice(-400)));
console.log('=========== 模板渲染 enable_thinking=true（末尾）===========');
console.log(JSON.stringify(tpl(true).slice(-400)));

const gen = await pipeline('text-generation', MODEL, { dtype: 'q4' });

const picks = [
  ['bicycle', 'car'],
  ['big', 'large'],
  ['happy', 'glad'],
  ['apartment', 'flat'],
];

for (const [e, t] of picks) {
  const p = PAIRS.find((x) => x.expected === e && x.typed === t);
  if (!p) continue;
  const prompt = tpl(false).replace(msgsFor(PAIRS[0]) ? '' : '', ''); // no-op keep simple
  void prompt;
  const realPrompt = tok.apply_chat_template(msgsFor(p), {
    tokenize: false,
    add_generation_prompt: true,
    enable_thinking: false,
  });
  const out = await gen(realPrompt, { max_new_tokens: 16, do_sample: false });
  const full = out[0].generated_text;
  const genPart = full.startsWith(realPrompt) ? full.slice(realPrompt.length) : full;
  console.log(`\n--- ${e} -> ${t} (label=${p.label}) ---`);
  console.log('RAW:', JSON.stringify(genPart));
}

// 对比：直接传 messages 数组（原 POC 的调用方式）
const p0 = PAIRS.find((x) => x.expected === 'bicycle' && x.typed === 'car');
const outM = await gen(msgsFor(p0), { max_new_tokens: 16, do_sample: false });
console.log('\n--- 原 POC 的 messages-array 调用（bicycle -> car，应为 NO）---');
console.log('OUT:', JSON.stringify(outM[0].generated_text).slice(0, 1000));

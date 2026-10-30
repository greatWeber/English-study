/**
 * 本地近义替换判定（NLI cross-encoder）
 *
 * 用 Xenova/nli-deberta-v3-xsmall 判断「把原词换成学生答案后，句子是否仍被原句蕴含」。
 * 全部在本机 CPU 运行，模型走 hf-mirror.com 下载，缓存于 node_modules。
 *
 * 只在「不精确匹配」时调用（见 hooks/usePractice + app/api/judge）。
 * 纯服务端模块 —— 不要在客户端组件里 import。
 *
 * 离线测评（tools/semantic-review/）：27 条人工标注集上准确率 92.6%，约 5ms/题。
 *
 * ⚠️ 重要局限：NLI 只判断语义蕴含，**完全没有词形/语法概念**。
 *    句子其余部分不变时，把目标词拼错它照样给高分，且句子越长越明显
 *    （实测 wonderful→wondefull：4 词句 0.79，18 词句 0.93）。
 *    所以进来之前必须先用 looksLikeTypo() 把拼写错误挡掉，
 *    NLI 只负责「两个都拼对的词，意思是否等价」。
 */

import { editDistance, looksLikeTypo, sameLemma } from '@/lib/utils';

const MODEL_ID = process.env.NLI_MODEL || 'Xenova/nli-deberta-v3-xsmall';

/**
 * 接受阈值。0.9 太松（wondefull 拿到 0.907 就混过去了），抬到 0.95。
 * 短词（≤3 字母）容易和标准答案撞形，再多要一点余量，但别超过真同义词的水平：
 * 实测 kid=0.988 / cab=0.994 / fix=0.996 / flat=0.995，所以定 0.98。
 */
const MIN_ENTAIL = 0.95;
const MIN_ENTAIL_SHORT = 0.98;
const MAX_CONTRA = 0.1;

/** 同音/形近易混词：NLI 只看语义不看语法，这类必须直接否决 */
const CONFUSABLE: Array<[string, string]> = [
  ['their', 'there'],
  ['your', "you're"],
  ["it's", 'its'],
  ['then', 'than'],
  ['to', 'too'],
  ['affect', 'effect'],
  ['lose', 'loose'],
  ['quiet', 'quite'],
  ['principle', 'principal'],
  ['weather', 'whether'],
  ['wear', 'where'],
  ['accept', 'except'],
  ['advice', 'advise'],
  ['stationary', 'stationery'],
  ['breath', 'breathe'],
  ['desert', 'dessert'],
  ['personal', 'personnel'],
  ['cite', 'site'],
  ['peace', 'piece'],
  ['meat', 'meet'],
  ['bare', 'bear'],
  ['fair', 'fare'],
  ['here', 'hear'],
  ['right', 'write'],
  ['sea', 'see'],
  ['son', 'sun'],
  ['week', 'weak'],
  ['wood', 'would'],
  ['board', 'bored'],
  ['break', 'brake'],
  ['plain', 'plane'],
  ['steal', 'steel'],
  ['wait', 'weight'],
  ['whole', 'hole'],
  ['blue', 'blew'],
  ['buy', 'by'],
  ['cent', 'scent'],
  ['dear', 'deer'],
  ['flower', 'flour'],
  ['heal', 'heel'],
  ['know', 'no'],
  ['male', 'mail'],
  ['one', 'won'],
  ['pair', 'pear'],
  ['role', 'roll'],
  ['tail', 'tale'],
  ['through', 'threw'],
  ['way', 'weigh'],
];

const normalize = (w: string) =>
  w
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z']/g, '');

function isConfusable(a: string, b: string) {
  const x = normalize(a);
  const y = normalize(b);
  return CONFUSABLE.some(([p, q]) => (x === p && y === q) || (x === q && y === p));
}

/** 把整句里的 expected（整词、忽略大小写）换成 typed，构造「学生写的句子」 */
function substitute(sentence: string, expected: string, typed: string) {
  const escaped = expected.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`\\b${escaped}\\b`, 'gi');
  return sentence.replace(re, typed);
}

function softmax(arr: number[]) {
  const m = Math.max(...arr);
  const ex = arr.map((x) => Math.exp(x - m));
  const sum = ex.reduce((a, b) => a + b, 0);
  return ex.map((x) => x / sum);
}

/* ---------------- 懒加载单例 ---------------- */

type Engine = {
  // 避免直接依赖 @huggingface/transformers 的类型导出
  tokenizer: (text: string, options?: Record<string, unknown>) => unknown;
  model: (inputs: unknown) => Promise<{ logits: { tolist: () => number[][] } }>;
  entailIndex: number;
  contraIndex: number;
};

let enginePromise: Promise<Engine | null> | null = null;

async function loadEngine(): Promise<Engine | null> {
  if (!enginePromise) {
    enginePromise = (async () => {
      try {
        const tf = await import('@huggingface/transformers');
        // 国内网络：默认走 hf-mirror，可用 HF_ENDPOINT 覆盖
        tf.env.remoteHost = process.env.HF_ENDPOINT || 'https://hf-mirror.com';
        tf.env.remotePathTemplate = '{model}/resolve/{revision}/';
        tf.env.allowLocalModels = true;
        tf.env.useFSCache = true;

        const tokenizer = await tf.AutoTokenizer.from_pretrained(MODEL_ID);
        const model = await tf.AutoModelForSequenceClassification.from_pretrained(MODEL_ID, {
          dtype: 'q8',
        });

        const config = model.config as unknown as { id2label?: Record<string, string> };
        const id2label = config?.id2label ?? {};
        let entailIndex = 2;
        let contraIndex = 0;
        for (const [index, label] of Object.entries(id2label)) {
          const l = String(label).toLowerCase();
          if (l.includes('entail')) entailIndex = Number(index);
          if (l.includes('contra')) contraIndex = Number(index);
        }

        console.log(`[semanticJudge] ${MODEL_ID} 已就绪 (entail#${entailIndex} contra#${contraIndex})`);
        return {
          tokenizer: tokenizer as unknown as Engine['tokenizer'],
          model: model as unknown as Engine['model'],
          entailIndex,
          contraIndex,
        };
      } catch (err) {
        console.error('[semanticJudge] 模型加载失败，近义复核将跳过：', err);
        return null;
      }
    })();
  }
  return enginePromise;
}

export type JudgeVerdict = {
  accept: boolean;
  entail: number;
  contra: number;
  /** 判定来源，便于调试：semantic / typo / confusable / empty / no-substitution / unavailable / low */
  reason: string;
};

/**
 * 判断 typed 能否在 sentence 里替换 expected 而不改变含义。
 * @param sentence 原句（英文完整句子）
 * @param expected 标准答案单词
 * @param typed    学生写的单词
 */
export async function judgeAlternative({
  sentence,
  expected,
  typed,
}: {
  sentence: string;
  expected: string;
  typed: string;
}): Promise<JudgeVerdict> {
  const t = normalize(typed);
  if (!t || !sentence || !expected) {
    return { accept: false, entail: 0, contra: 0, reason: 'empty' };
  }

  // ① 拼写错误优先拦截。NLI 看不懂拼写，长句里必然放行，所以这层必须在前。
  if (looksLikeTypo(expected, typed)) {
    return { accept: false, entail: 0, contra: 0, reason: 'typo' };
  }

  // ② 同音/形近易混词（their/there、affect/effect）—— 语义相近但语法错误。
  //    必须排在词形检查前面：affect/effect 去掉前缀都能缩到 fect，会被误判成同词根。
  if (isConfusable(expected, typed)) {
    return { accept: false, entail: 0, contra: 0, reason: 'confusable' };
  }

  // ③ 同一个词的不同变形（sheep/sheeps、go/goes、mice/mouse、tall/taller）。
  //    NLI 对词形完全无感（实测 8 例中 7 例 entail≥0.95），且编辑距离也分不开
  //    （词形错 dist 1~3，真同义词 taxi/cab 同样 dist 3），只能靠词根还原拦。
  if (sameLemma(expected, typed)) {
    return { accept: false, entail: 0, contra: 0, reason: 'form-error' };
  }

  const hypothesis = substitute(sentence, expected, typed);
  if (hypothesis === sentence) {
    // 原句里没找到标准答案词，无法构造对照
    return { accept: false, entail: 0, contra: 0, reason: 'no-substitution' };
  }

  const engine = await loadEngine();
  if (!engine) {
    return { accept: false, entail: 0, contra: 0, reason: 'unavailable' };
  }

  const inputs = engine.tokenizer(sentence, { text_pair: hypothesis });
  const output = await engine.model(inputs);
  const probs = softmax(output.logits.tolist()[0]);
  const entail = probs[engine.entailIndex] ?? 0;
  const contra = probs[engine.contraIndex] ?? 0;

  // ③ 极短的词（1–3 字母）风险高，要求更高的蕴含分
  const minEntail = t.length <= 3 ? MIN_ENTAIL_SHORT : MIN_ENTAIL;
  const accept = entail >= minEntail && contra < MAX_CONTRA;

  return { accept, entail, contra, reason: accept ? 'semantic' : 'low' };
}

/** 导出给测评脚本 / 调试用 */
export const judgeThresholds = { MIN_ENTAIL, MIN_ENTAIL_SHORT, MAX_CONTRA };
export { editDistance, looksLikeTypo };

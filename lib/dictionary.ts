/**
 * 离线单词词典查询（纯服务端模块 —— 不要在客户端组件里 import）
 *
 * 数据来自 lib/build-dict.mjs 生成的 word_dict 表（ECDICT 常用词 + 变形展开）。
 * 查词顺序：
 *   ① 原词直接命中（含 walked→walk 这类变形行，自带 inf_of/inf_label）
 *   ② 没命中则用 lemmaCandidates() 做规则词形还原，逐个候选再查
 *   ③ 英美拼写互换后再试一次（colour↔color）
 */

import { getDictEntry } from '@/lib/sqlite';
import { lemmaCandidates, normalizeWord, spellingVariant } from '@/lib/utils';

export type WordEntry = {
  word: string;
  phonetic: string;
  translation: string;
  definition: string;
  pos: string;
  collins: number;
  oxford: number;
  tag: string;
  /** 变形词指向的原形（walked → walk），非变形词为空 */
  infOf: string;
  /** 变形说明（过去式 / 现在分词 / 复数…） */
  infLabel: string;
};

type DictRow = {
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
};

const toEntry = (row: DictRow): WordEntry => ({
  word: row.word,
  phonetic: row.phonetic,
  translation: row.translation,
  definition: row.definition,
  pos: row.pos,
  collins: row.collins,
  oxford: row.oxford,
  tag: row.tag,
  infOf: row.inf_of,
  infLabel: row.inf_label,
});

/** 考试/教材标签 → 友好中文 */
const TAG_LABEL: Array<[RegExp, string]> = [
  [/zk/, '中考'],
  [/gk/, '高考'],
  [/cet4/, '四级'],
  [/cet6/, '六级'],
  [/ky/, '考研'],
  [/toefl/, 'TOEFL'],
  [/ielts/, 'IELTS'],
  [/gre/, 'GRE'],
];

export function examTags(tag: string): string[] {
  if (!tag) return [];
  return TAG_LABEL.filter(([re]) => re.test(tag)).map(([, label]) => label);
}

/**
 * 查一个词。selectedText 是用户选中的原始文本（可能带大小写/撇号）。
 * 找不到返回 null，由调用方决定怎么提示。
 */
export function lookupWord(selectedText: string): WordEntry | null {
  const raw = normalizeWord(selectedText || '');
  if (!raw || raw.length > 24) return null;

  const direct = getDictEntry(raw);
  if (direct) return toEntry(direct);

  // ② 规则词形还原兜底（词典变形表没覆盖到的词形，靠 utils 的后缀规则再试一轮）
  for (const cand of lemmaCandidates(raw)) {
    if (cand === raw) continue;
    const hit = getDictEntry(cand);
    if (hit) {
      const entry = toEntry(hit);
      if (!entry.infOf) {
        entry.infOf = cand;
        entry.infLabel = infLabelOf(raw, cand);
      }
      return entry;
    }
  }

  // ③ 英美拼写互换（colour↔color 词典里两边都有，此步只是保险）
  for (const cand of lemmaCandidates(raw)) {
    const hit = getDictEntry(cand);
    if (hit && spellingVariant(cand, raw)) return toEntry(hit);
  }

  return null;
}

/** 给规则还原出来的变形猜一个说明文案 */
function infLabelOf(form: string, base: string): string {
  if (form.endsWith('ing')) return '现在分词';
  if (form.endsWith('ed')) return form === `${base}s` ? '过去式 / 过去分词' : '过去式';
  if (form === `${base}s` || form === `${base}es`) return '复数 / 三单';
  if (form.endsWith('ier') || form.endsWith('er')) return '比较级';
  if (form.endsWith('iest') || form.endsWith('est')) return '最高级';
  return '原形';
}

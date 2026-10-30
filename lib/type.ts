export type Sentence = {
  id: string;
  dataset_id: string;
  level: string;
  category: string;
  text: string;
  zh?: string | null;
  blanks?: string | string[] | null;
  source?: string | null;
  total_attempts?: number;
  correct_count?: number;
  next_review_at?: string | null;
};

export type PracticeRecord = {
  sentenceId: string;
  datasetId: string;
  mode: 'fill' | 'dictation';
  correct: boolean;
  mistakes: number;
  timeSpent: number;
  typedText: string;
};

export type Mode = 'fill' | 'dictation';
export type Phase = 'typing' | 'checked' | 'revealed' | 'summary';

export type Token = { kind: 'word' | 'space' | 'punct'; text: string };

export type Blank = {
  order: number;
  tokenIndex: number;
  answer: string;
};

export type Exercise = {
  tokens: Token[];
  blanks: Blank[];
  blankByToken: Record<number, number>;
};

export type Mark = { ch: string; ok: boolean };

export type CheckDetail = {
  order: number;
  expected: string;
  typed: string;
  correct: boolean;
  missing: boolean;
  marks: Mark[];
  extra: string[];
  /** 判对但并非逐字一致：英美拼写变体或经 NLI 复核通过的近义替换 */
  alternative?: boolean;
  /** 更像把标准答案拼错了（编辑距离很小），用于区分「拼写错误」和「用词错误」 */
  typo?: boolean;
  /** 同一个词的另一种变形（sheep→sheeps、go→goes），属于词形/语法错误 */
  formError?: boolean;
};

/** 一个待复核的空（学生写了词，但不与标准答案逐字一致） */
export type JudgeItem = {
  order: number;
  expected: string;
  typed: string;
};

/** 本地 NLI 复核结果 */
export type JudgeResult = {
  order: number;
  accept: boolean;
  entail: number;
  contra: number;
  cached?: boolean;
};

export type Attempt = {
  sentenceId: string;
  text: string;
  zh?: string | null;
  correct: boolean;
  mistakes: number;
  details: CheckDetail[];
  extraWords?: string[];
};

export type Toast = { msg: string; type: 'ok' | 'warn' };

export type DictationPart = {
  text: string;
  isWord: boolean;
  wordIndex?: number;
};

export type DictationCheck = {
  details: CheckDetail[];
  extraWords: string[];
  mistakes: number;
  correct: boolean;
};

export type RenderChunk = {
  space: string;
  wordText?: string;
  blankOrder?: number;
  punct: string;
};
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
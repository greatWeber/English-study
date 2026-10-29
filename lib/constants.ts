export const LEVELS = [
  { id: 'A1', label: 'A1 入门', desc: '最基础的日常表达、短句' },
  { id: 'A2', label: 'A2 初级', desc: '常见场景的简单交流' },
  { id: 'B1', label: 'B1 中级', desc: '能描述经历与观点' },
  { id: 'B2', label: 'B2 中高级', desc: '抽象话题、地道搭配' },
  { id: 'C1', label: 'C1 高级', desc: '学术与职场进阶词汇' },
  { id: 'C2', label: 'C2 精通', desc: '低频词、修辞与书面语' },
];

export const CATEGORIES = [
  { id: 'daily', label: '日常生活', icon: '🏠' },
  { id: 'travel', label: '出行旅行', icon: '✈️' },
  { id: 'food', label: '餐饮美食', icon: '🍽️' },
  { id: 'shopping', label: '购物消费', icon: '🛍️' },
  { id: 'study', label: '校园学习', icon: '📚' },
  { id: 'work', label: '职场办公', icon: '💼' },
  { id: 'health', label: '健康医疗', icon: '🩺' },
  { id: 'social', label: '社交寒暄', icon: '💬' },
];

export const MODES = [
  { id: 'fill', label: '填空题', desc: '挖掉关键单词，填空练习' },
  { id: 'dictation', label: '整句默写', desc: '整句逐词默写，更有挑战' },
];

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

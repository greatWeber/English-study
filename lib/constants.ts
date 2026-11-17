export const TRACKS = [
  {
    id: 'campus',
    label: '校园成长',
    icon: '🌱',
    desc: '每天一点点，适合 K12 与日常提升',
  },
  {
    id: 'exam',
    label: '考试冲刺',
    icon: '🎯',
    desc: '对准目标考试词表，练得更高效',
  },
] as const;

export type TrackId = (typeof TRACKS)[number]['id'];

export const EXAMS = [
  { id: 'zk', label: '中考核心', short: '中考', group: 'campus', tag: 'zk' },
  { id: 'gk', label: '高考核心', short: '高考', group: 'campus', tag: 'gk' },
  { id: 'cet4', label: 'CET-4', short: '四级', group: 'exam', tag: 'cet4' },
  { id: 'cet6', label: 'CET-6', short: '六级', group: 'exam', tag: 'cet6' },
  { id: 'ky', label: '考研', short: '考研', group: 'exam', tag: 'ky' },
  { id: 'ielts', label: 'IELTS', short: '雅思', group: 'exam', tag: 'ielts' },
  { id: 'toefl', label: 'TOEFL', short: '托福', group: 'exam', tag: 'toefl' },
  { id: 'gre', label: 'GRE', short: 'GRE', group: 'exam', tag: 'gre' },
] as const;

export type ExamId = (typeof EXAMS)[number]['id'];

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

export const FUNCTION_WORDS = new Set([
  'a', 'an', 'the', 'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should',
  'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought', 'used',
  'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'into', 'onto',
  'as', 'and', 'or', 'but', 'nor', 'so', 'yet', 'if', 'unless', 'because',
  'since', 'while', 'when', 'where', 'whether', 'that', 'which', 'who',
  'whom', 'whose', 'what', 'how', 'why', 'there', 'here', 'then', 'than',
  'not', 'no', 'never', 'ever', 'just', 'only', 'also', 'even', 'still',
  'already', 'yet', 'again', 'ever', 'quite', 'rather', 'very', 'too',
  'so', 'such', 'both', 'either', 'neither', 'each', 'every', 'all',
  'some', 'any', 'many', 'much', 'few', 'little', 'more', 'most', 'less',
  'least', 'own', 'same', 'other', 'another', 'such', 'my', 'your',
  'his', 'her', 'its', 'our', 'their', 'me', 'you', 'him', 'she', 'he', 'it',
  'we', 'they', 'us', 'them', 'i', 'this', 'these', 'those', 'it',
]);

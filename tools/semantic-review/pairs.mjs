// 人工标注的「可接受答案」测评集
// label: 'eq'  = 学生答案语义等价，应当判对
//        'neq' = 语义不等价，应当判错
// sentence 里包含 expected 原词；脚本会把 expected 替换成 typed 造出「学生句」，
// 用于「语境版」判断（把词放回整句再比较，比裸词更可靠）。
// zh 只喂给 LLM 判官，作为歧义消解线索。

export const PAIRS = [
  // ---------- 正例：同义词 / 近义替换 ----------
  { sentence: 'I want to ride a bicycle to school.', zh: '我想骑车去上学。', expected: 'bicycle', typed: 'bike', label: 'eq' },
  { sentence: 'She bought a car last week.', zh: '她上周买了一辆车。', expected: 'car', typed: 'automobile', label: 'eq' },
  { sentence: 'The child is playing in the garden.', zh: '那个孩子在花园里玩。', expected: 'child', typed: 'kid', label: 'eq' },
  { sentence: 'We should begin the meeting now.', zh: '我们现在应该开始会议了。', expected: 'begin', typed: 'start', label: 'eq' },
  { sentence: 'They live in a big house.', zh: '他们住在一栋大房子里。', expected: 'big', typed: 'large', label: 'eq' },
  { sentence: 'He will purchase a new phone.', zh: '他将会买一部新手机。', expected: 'purchase', typed: 'buy', label: 'eq' },
  { sentence: 'The film was really great.', zh: '那部电影真的很棒。', expected: 'film', typed: 'movie', label: 'eq' },
  { sentence: 'Let us take a taxi to the airport.', zh: '我们打车去机场吧。', expected: 'taxi', typed: 'cab', label: 'eq' },
  { sentence: 'The shop is closed on Sundays.', zh: '这家店周日关门。', expected: 'shop', typed: 'store', label: 'eq' },
  { sentence: 'He is very happy today.', zh: '他今天非常开心。', expected: 'happy', typed: 'glad', label: 'eq' },
  { sentence: 'She is a clever student.', zh: '她是个聪明的学生。', expected: 'clever', typed: 'smart', label: 'eq' },
  { sentence: 'This task is quite difficult.', zh: '这个任务相当难。', expected: 'difficult', typed: 'hard', label: 'eq' },
  { sentence: 'My apartment is small but clean.', zh: '我的公寓虽小但很干净。', expected: 'apartment', typed: 'flat', label: 'eq' }, // 美/英
  { sentence: 'The colour of the sky is blue.', zh: '天空的颜色是蓝色。', expected: 'colour', typed: 'color', label: 'eq' }, // 英/美拼写
  { sentence: 'He will repair the old bike.', zh: '他会修理那辆旧自行车。', expected: 'repair', typed: 'fix', label: 'eq' },

  // ---------- 反例：意思不同，必须判错 ----------
  { sentence: 'I want to ride a bicycle to school.', zh: '我想骑车去上学。', expected: 'bicycle', typed: 'car', label: 'neq' },
  { sentence: 'She bought a car last week.', zh: '她上周买了一辆车。', expected: 'car', typed: 'bike', label: 'neq' },
  { sentence: 'We should begin the meeting now.', zh: '我们现在应该开始会议了。', expected: 'begin', typed: 'stop', label: 'neq' },
  { sentence: 'They live in a big house.', zh: '他们住在一栋大房子里。', expected: 'big', typed: 'small', label: 'neq' },
  { sentence: 'He will purchase a new phone.', zh: '他将会买一部新手机。', expected: 'purchase', typed: 'sell', label: 'neq' },
  { sentence: 'The film was really great.', zh: '那部电影真的很棒。', expected: 'film', typed: 'bad', label: 'neq' },
  { sentence: 'He is very happy today.', zh: '他今天非常开心。', expected: 'happy', typed: 'sad', label: 'neq' },
  { sentence: 'The shop is closed on Sundays.', zh: '这家店周日关门。', expected: 'closed', typed: 'open', label: 'neq' },
  { sentence: 'This task is quite difficult.', zh: '这个任务相当难。', expected: 'difficult', typed: 'easy', label: 'neq' },
  { sentence: 'She is a clever student.', zh: '她是个聪明的学生。', expected: 'clever', typed: 'stupid', label: 'neq' },

  // ---------- 易混淆的坑 ----------
  { sentence: 'They put their bags on the table.', zh: '他们把包放在桌上。', expected: 'their', typed: 'there', label: 'neq' },
  { sentence: 'The new rule will affect everyone.', zh: '新规定会影响每个人。', expected: 'affect', typed: 'effect', label: 'neq' },
];

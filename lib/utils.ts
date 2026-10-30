import { FUNCTION_WORDS } from "./constants";
import { Blank, CheckDetail, DictationCheck, DictationPart, Exercise, Mark, Mode, RenderChunk, Token } from "./type";

export function tokenize(text: string) {
  const tokens: Token[] = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      let j = i;
      while (j < text.length && /\s/.test(text[j])) j++;
      tokens.push({ kind: 'space', text: text.slice(i, j) });
      i = j;
    } else if (/[.,!?;:()'"…—–-]/.test(ch)) {
      let j = i;
      while (j < text.length && /[.,!?;:()'"…—–-]/.test(text[j])) j++;
      tokens.push({ kind: 'punct', text: text.slice(i, j) });
      i = j;
    } else {
      let j = i;
      while (j < text.length && !/\s/.test(text[j]) && !/[.,!?;:()'"…—–-]/.test(text[j])) j++;
      tokens.push({ kind: 'word', text: text.slice(i, j) });
      i = j;
    }
  }
  return tokens;
}



export function isContentWord(w: string) {
  const lw = w.toLowerCase();
  if (FUNCTION_WORDS.has(lw)) return false;
  return /^[A-Za-z']+$/.test(lw);
}

export function normalizeWord(w: string) {
  return w.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z']/g, '');
}

/* ============================================================
   英美拼写变体：colour/color、realise/realize、centre/center …
   纯规则，不依赖模型，命中即判对（标记为「可接受替换」）
   ============================================================ */

/** 词尾成对规则：[模式, 替换]，要求替换后与对方完全相同才算变体 */
const SPELLING_RULES: Array<[RegExp, string, number]> = [
  // [规则, 替换, 最短词长]
  [/our\b/, 'or', 4], // colour → color, favourite → favorite
  [/or\b/, 'our', 4],
  [/isation\b/, 'ization', 8], // organisation → organization
  [/ization\b/, 'isation', 8],
  [/ise\b/, 'ize', 5], // realise → realize
  [/ize\b/, 'ise', 5],
  [/yse\b/, 'yze', 5], // analyse → analyze
  [/yze\b/, 'yse', 5],
  [/re\b/, 'er', 4], // centre → center, metre → meter
  [/er\b/, 're', 4],
  [/ence\b/, 'ense', 6], // defence → defense
  [/ense\b/, 'ence', 6],
  [/ogue\b/, 'og', 6], // catalogue → catalog
  [/og\b/, 'ogue', 6],
  [/lled\b/, 'led', 5], // travelled → traveled
  [/led\b/, 'lled', 5],
  [/lling\b/, 'ling', 6], // travelling → traveling
  [/ling\b/, 'lling', 6],
  [/lment\b/, 'llment', 6], // enrolment → enrollment
  [/llment\b/, 'lment', 6],
  [/ae/, 'e', 5], // encyclopaedia → encyclopedia
  [/oe/, 'e', 5], // oesophagus → esophagus
];

/** 无规则的整词对应（无法用词尾规则覆盖的） */
const SPELLING_SPECIAL: Record<string, string> = {
  grey: 'gray',
  gray: 'grey',
  tyre: 'tire',
  tire: 'tyre',
  aluminium: 'aluminum',
  aluminum: 'aluminium',
  aeroplane: 'airplane',
  airplane: 'aeroplane',
  programme: 'program',
  program: 'programme',
  whisky: 'whiskey',
  whiskey: 'whisky',
  plough: 'plow',
  plow: 'plough',
  moustache: 'mustache',
  mustache: 'moustache',
  jewellery: 'jewelry',
  jewelry: 'jewellery',
  enrol: 'enroll',
  enroll: 'enrol',
  fulfil: 'fulfill',
  fulfill: 'fulfil',
  instil: 'instill',
  distill: 'distil',
  skilful: 'skillful',
  skillful: 'skilful',
  wilful: 'willful',
  willful: 'wilful',
};

/** a、b 是否只是英美拼写差异（内部已做 normalize） */
export function spellingVariant(a: string, b: string) {
  const x = normalizeWord(a);
  const y = normalizeWord(b);
  if (!x || !y || x === y) return false;
  if (SPELLING_SPECIAL[x] === y) return true;
  for (const [re, replacement, minLen] of SPELLING_RULES) {
    if (x.length >= minLen && re.test(x) && x.replace(re, replacement) === y) return true;
  }
  return false;
}

/* ============================================================
   拼写错误（typo）识别
   ------------------------------------------------------------
   NLI 模型只判断「语义是否蕴含」，完全没有词形/语法概念：
   句子其余部分几乎一模一样时，把一个词拼错它照样给高分
   （实测 wonderful→wondefull 在长句里 entail=0.93）。

   但拼写错误有个可靠的特征：它和标准答案**写得非常像**，
   而真正的同义词几乎总是**写得很不一样**：
     typo   wondefull/wonderful = 2   famliy/family = 1（字母转置）
     真同义 cab/taxi = 3   store/shop = 3   bike/bicycle = 4
   所以「编辑距离小 + 相对距离小」= 拼写错误，直接判错，不进 NLI。
   不需要词典，零成本、确定性。
   ============================================================ */

/** Damerau–Levenshtein 距离（含相邻字母转置，能认出 famliy / bicycel 这类） */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return d[m][n];
}

/**
 * typed 是否更像「把标准答案拼错了」，而不是「换了个同义词」。
 * 绝对距离 ≤2 且 相对距离 ≤1/3 —— 两个条件都要满足，
 * 这样 cab/taxi（3）不会被误伤，而 famliy/family（1）一定拦得住。
 */
export function looksLikeTypo(expected: string, typed: string): boolean {
  const x = normalizeWord(expected);
  const y = normalizeWord(typed);
  if (!x || !y || x === y) return false;
  const dist = editDistance(x, y);
  if (dist === 0) return false;
  const ratio = dist / Math.max(x.length, y.length);
  return dist <= 2 && ratio <= 0.34;
}

/* ============================================================
   词形（inflection）识别：同词不同形
   ------------------------------------------------------------
   NLI 同样看不懂词形 —— 实测 8 个词形错误里 7 个 entail ≥ 0.95：
     sheep→sheeps 0.992   go→goes 0.995   tall→taller 0.990
     mice→mouse 0.988     singer→singing 0.985   informations→information 0.967
   而且**编辑距离也分不开**：词形错误距离 1~3，
   但真同义词 taxi/cab、shop/store、child/kid 距离同样是 3。

   可靠的区分点是**词位（lemma）**：
     真同义词 = 两个不同的词（taxi ≠ cab）
     词形错误 = 同一个词的不同变形（sheep ↔ sheeps）
   因为标准答案永远来自原文，「同词不同形」必然就是学生变形错了。

   做法：把两边各自还原到词根（规则后缀 + 不规则表），看有没有交集。
   不需要词典，纯字符串规则。
   ============================================================ */

/** 不规则变形 → 统一词根（复数 / 过去式 / 比较级） */
const INFLECTION_BASE: Record<string, string> = {
  // 不规则复数
  men: 'man', women: 'woman', children: 'child', teeth: 'tooth', feet: 'foot',
  geese: 'goose', mice: 'mouse', people: 'person', leaves: 'leaf', knives: 'knife',
  wives: 'wife', wolves: 'wolf', lives: 'life', halves: 'half', shelves: 'shelf',
  thieves: 'thief', cacti: 'cactus', fungi: 'fungus', analyses: 'analysis',
  crises: 'crisis', theses: 'thesis', phenomena: 'phenomenon', media: 'medium',
  // be / have / do / go / say 等高频动词
  am: 'be', is: 'be', are: 'be', was: 'be', were: 'be', been: 'be', being: 'be',
  has: 'have', had: 'have', having: 'have',
  does: 'do', did: 'do', done: 'do', doing: 'do',
  goes: 'go', went: 'go', gone: 'go', going: 'go',
  says: 'say', said: 'say',
  // 比较级 / 最高级
  better: 'good', best: 'good', worse: 'bad', worst: 'bad',
};

/** 规则后缀还原：对每个候选词依次套用，收集所有可达词根 */
const SUFFIX_RULES: Array<[RegExp, string]> = [
  [/ies$/, 'y'], // babies → baby
  [/ied$/, 'y'], // carried → carry
  [/ier$/, 'y'], // happier → happy
  [/iest$/, 'y'], // happiest → happy
  [/ying$/, 'ie'], // dying → die
  [/ving$/, 'f'], // living → live? (也覆盖 wolves→wolves 类)
  [/ves$/, 'f'], // knives → knif（近似，配合其它候选）
  [/([^aeiou])\1(?:ing|ed|er|est|s)$/, '$1'], // running→run, stopped→stop, bigger→big
  [/ing$/, ''], [/ing$/, 'e'], // making → make
  [/ed$/, ''], [/ed$/, 'e'],
  [/es$/, ''],
  [/s$/, ''],
  [/er$/, ''], [/est$/, ''],
  [/ily$/, 'y'], // happily → happy
  [/ly$/, ''],
  [/i$/, 'y'],
];

const dedupeTail = (s: string) => s.replace(/([^aeiou])\1$/, '$1');

/** 一个词所有可能的词根候选（含自身） */
function lemmaCandidates(word: string): string[] {
  const start = normalizeWord(word);
  const seen = new Set<string>();
  const out: string[] = [];
  if (!start) return out;
  const queue = [start];
  while (queue.length) {
    const cur = queue.shift() as string;
    if (seen.has(cur)) continue;
    seen.add(cur);
    out.push(cur);
    const irregular = INFLECTION_BASE[cur];
    if (irregular && !seen.has(irregular)) queue.push(irregular);
    for (const [re, rep] of SUFFIX_RULES) {
      if (!re.test(cur)) continue;
      const cand = dedupeTail(cur.replace(re, rep));
      if (cand.length >= 2 && !seen.has(cand)) queue.push(cand);
    }
  }
  return out;
}

/**
 * 把 from 归约到 to 所需的最小「形近编辑距离」（只统计删除/替换类操作）。
 * 即：允许删词尾（s/es/ed/ing/ly… 这类屈折），不允许塞进额外字母。
 * 这样 sheep→sheep（删 1）成立，但 animate→anim（删 ate=3）不成立，
 * 避免 animate/animal 这种「碰巧共享词尾片段」被误判成同词根。
 */
function reductionDistance(from: string, to: string): number {
  if (from.length < to.length) return Infinity;
  const max = from.length - to.length;
  if (max > 3) return Infinity;
  return editDistance(from, to);
}

/**
 * a、b 是否是**同一个词的不同变形**（sheep/sheeps、go/goes、mice/mouse、tall/taller）。
 * 命中即说明学生用的是同一个词但形不对 —— 这是语法错误，不能算近义替换。
 *
 * 要求存在一对词根，彼此通过「删词尾」可达（≤3 个字符，且方向为缩短）。
 */
export function sameLemma(a: string, b: string): boolean {
  const x = normalizeWord(a);
  const y = normalizeWord(b);
  if (!x || !y || x === y) return false;
  const xs = lemmaCandidates(x);
  const ys = lemmaCandidates(y);
  for (const cx of xs) {
    for (const cy of ys) {
      if (cx === cy) {
        // 直接相等：必须两边都是靠「删后缀」到达的，长度差不能太大
        if (Math.abs(x.length - y.length) <= 3) return true;
        continue;
      }
      if (reductionDistance(cx, cy) <= 1 || reductionDistance(cy, cx) <= 1) return true;
    }
  }
  return false;
}

/* ============================================================
   整句默写：把句子拆成「单词 / 非单词」片段
   ============================================================ */

const DICTATION_WORD_PATTERN = /[A-Za-z0-9]+(?:['’‘-][A-Za-z0-9]+)*/g;

export function splitDictation(text: string): DictationPart[] {
  const parts: DictationPart[] = [];
  const re = new RegExp(DICTATION_WORD_PATTERN.source, 'g');
  let lastIndex = 0;
  let wordIndex = 0;
  let match: RegExpExecArray | null = re.exec(text);

  while (match) {
    if (match.index > lastIndex) {
      parts.push({ text: text.slice(lastIndex, match.index), isWord: false });
    }
    parts.push({ text: match[0], isWord: true, wordIndex: wordIndex++ });
    lastIndex = match.index + match[0].length;
    match = re.exec(text);
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), isWord: false });
  }

  return parts;
}

export function dictationWords(text: string) {
  return splitDictation(text)
    .filter((part) => part.isWord)
    .map((part) => part.text);
}

export function countDictationWords(text: string) {
  return dictationWords(text).length;
}

export function normalizeDictationWord(word: string) {
  return word.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9']/g, '');
}

export function buildDictationHint(text: string) {
  return splitDictation(text)
    .map((part) => {
      if (!part.isWord) return part.text;
      const first = part.text[0] ?? '';
      return `${first}${'·'.repeat(Math.max(part.text.length - 1, 0))}`;
    })
    .join('');
}

export function parseCuratedBlanks(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === 'string');
  }
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.filter((x): x is string => typeof x === 'string');
      }
    } catch {
      return [];
    }
  }
  return [];
}

export function buildExercise(text: string, mode: Mode, curatedRaw: unknown): Exercise {
  const tokens = tokenize(text);
  const wordIndexes: number[] = [];
  tokens.forEach((token, index) => {
    if (token.kind === 'word') wordIndexes.push(index);
  });

  let targetIndexes: number[] = [];

  if (mode === 'dictation') {
    // 整句默写：把所有实词都留空，虚词和标点保留，句子结构仍然看得见
    targetIndexes = wordIndexes.filter((idx) => isContentWord(tokens[idx].text));
    if (targetIndexes.length === 0) targetIndexes = wordIndexes.slice();
  } else {
    // 填空题：优先使用语料库里精心挑好的挖空单词
    const curated = parseCuratedBlanks(curatedRaw);
    const used = new Set<number>();
    for (const word of curated) {
      const normalized = normalizeWord(word);
      if (!normalized) continue;
      const found = wordIndexes.find(
        (idx) => !used.has(idx) && normalizeWord(tokens[idx].text) === normalized,
      );
      if (found !== undefined) {
        used.add(found);
        targetIndexes.push(found);
      }
    }

    // 没有挖空数据时，自动挑最长的几个实词
    if (targetIndexes.length === 0) {
      const candidates = wordIndexes
        .filter((idx) => isContentWord(tokens[idx].text))
        .sort((a, b) => tokens[b].text.length - tokens[a].text.length);
      const desired = Math.min(3, Math.max(1, candidates.length));
      const chosen: number[] = [];
      for (const idx of candidates) {
        if (chosen.length >= desired) break;
        if (chosen.some((c) => Math.abs(c - idx) <= 1)) continue;
        chosen.push(idx);
      }
      if (chosen.length === 0 && candidates.length > 0) chosen.push(candidates[0]);
      targetIndexes = chosen;
    }
  }

  targetIndexes = Array.from(new Set(targetIndexes)).sort((a, b) => a - b);

  const blanks: Blank[] = targetIndexes.map((tokenIndex, order) => ({
    order,
    tokenIndex,
    answer: tokens[tokenIndex].text,
  }));

  const blankByToken: Record<number, number> = {};
  blanks.forEach((blank) => {
    blankByToken[blank.tokenIndex] = blank.order;
  });

  return { tokens, blanks, blankByToken };
}

export function diffWord(expected: string, typed: string) {
  const expectedLower = expected.toLowerCase().replace(/[’‘]/g, "'");
  const typedLower = typed.toLowerCase().replace(/[’‘]/g, "'");
  const m = expectedLower.length;
  const n = typedLower.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (expectedLower[i - 1] === typedLower[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const marks: Mark[] = [];
  let i = m;
  let j = n;
  const typedUsed = new Set<number>();
  while (i > 0 && j > 0) {
    if (expectedLower[i - 1] === typedLower[j - 1]) {
      marks.unshift({ ch: expected[i - 1], ok: true });
      typedUsed.add(j - 1);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      marks.unshift({ ch: expected[i - 1], ok: false });
      i--;
    } else {
      j--;
    }
  }
  while (i > 0) {
    marks.unshift({ ch: expected[i - 1], ok: false });
    i--;
  }
  const extra = typed.split('').filter((_, idx) => !typedUsed.has(idx));
  return { marks, extra };
}

export function checkBlanks(exercise: Exercise, typedWords: string[]): CheckDetail[] {
  return exercise.blanks.map((blank) => {
    const typed = (typedWords[blank.order] ?? '').trim();
    const expected = blank.answer;
    const exact =
      typed.length > 0 && normalizeWord(typed) === normalizeWord(expected);
    // 英美拼写差异直接判对；同义替换留给本地 NLI 复核（hooks/usePractice）
    const spelling = !exact && spellingVariant(expected, typed);
    // 像拼错了（而不是换了个词）：立刻标记，UI 要区分「拼写错误」和「用词错误」
    const typo = !exact && !spelling && looksLikeTypo(expected, typed);
    // 同一个词但变形错了（sheep→sheeps、go→goes）：NLI 看不懂词形，这里先拦掉
    const formError = !exact && !spelling && !typo && sameLemma(expected, typed);
    const { marks, extra } = diffWord(expected, typed);
    return {
      order: blank.order,
      expected,
      typed,
      correct: exact || spelling,
      alternative: spelling,
      typo,
      formError,
      missing: typed.length === 0,
      marks: spelling ? typed.split('').map((ch) => ({ ch, ok: true })) : marks,
      extra: spelling ? [] : extra,
    };
  });
}

/* ============================================================
   整句默写判分：按单词对齐，忽略大小写和标点
   ============================================================ */

export function checkDictation(expected: string, typed: string): DictationCheck {
  const expectedWords = dictationWords(expected);
  const typedWords = dictationWords(typed);
  const m = expectedWords.length;
  const n = typedWords.length;

  const normalizedExpected = expectedWords.map(normalizeDictationWord);
  const normalizedTyped = typedWords.map(normalizeDictationWord);

  // 单词级编辑距离，用来把漏写、多写、拼错的词对齐
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array<number>(n + 1).fill(0),
  );
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const substitution =
        dp[i - 1][j - 1] +
        (normalizedExpected[i - 1] === normalizedTyped[j - 1] ? 0 : 1);
      dp[i][j] = Math.min(
        substitution,
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
      );
    }
  }

  type Operation = { expected?: string; typed?: string };
  const operations: Operation[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0) {
      const substitution =
        dp[i - 1][j - 1] +
        (normalizedExpected[i - 1] === normalizedTyped[j - 1] ? 0 : 1);
      if (dp[i][j] === substitution) {
        operations.push({
          expected: expectedWords[i - 1],
          typed: typedWords[j - 1],
        });
        i--;
        j--;
        continue;
      }
    }

    if (i > 0 && dp[i][j] === dp[i - 1][j] + 1) {
      operations.push({ expected: expectedWords[i - 1] });
      i--;
      continue;
    }

    if (j > 0) {
      operations.push({ typed: typedWords[j - 1] });
      j--;
    }
  }

  operations.reverse();

  const details: CheckDetail[] = [];
  const extraWords: string[] = [];
  let order = 0;

  operations.forEach((operation) => {
    if (operation.expected !== undefined) {
      const expectedWord = operation.expected;
      const typedWord = operation.typed ?? '';
      const exact =
        typedWord.length > 0 &&
        normalizeDictationWord(typedWord) ===
          normalizeDictationWord(expectedWord);
      const spelling =
        !exact &&
        spellingVariant(expectedWord, typedWord);
      const typo = !exact && !spelling && looksLikeTypo(expectedWord, typedWord);
      const formError =
        !exact && !spelling && !typo && sameLemma(expectedWord, typedWord);
      const { marks, extra } = diffWord(expectedWord, typedWord);
      details.push({
        order: order++,
        expected: expectedWord,
        typed: typedWord,
        correct: exact || spelling,
        alternative: spelling,
        typo,
        formError,
        missing: typedWord.length === 0,
        marks: spelling
          ? typedWord.split('').map((ch) => ({ ch, ok: true }))
          : marks,
        extra: spelling ? [] : extra,
      });
    } else if (operation.typed !== undefined) {
      extraWords.push(operation.typed);
    }
  });

  const mistakes =
    details.filter((detail) => !detail.correct).length + extraWords.length;

  return {
    details,
    extraWords,
    mistakes,
    correct:
      details.length > 0 &&
      details.every((detail) => detail.correct) &&
      extraWords.length === 0,
  };
}

export function buildTypedSentence(exercise: Exercise, typedWords: string[]) {
  return exercise.tokens
    .map((token, index) => {
      const order = exercise.blankByToken[index];
      if (order === undefined) return token.text;
      return (typedWords[order] ?? '').trim() || '___';
    })
    .join('');
}

export function buildChunks(exercise: Exercise): RenderChunk[] {
  const chunks: RenderChunk[] = [];
  const tokens = exercise.tokens;
  let pendingSpace = '';

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.kind === 'space') {
      pendingSpace += token.text;
      continue;
    }

    if (token.kind === 'punct') {
      // 紧跟在单词后的标点并进同一个 chunk，避免标点被挤到下一行
      if (chunks.length > 0 && pendingSpace === '') {
        chunks[chunks.length - 1].punct += token.text;
      } else {
        chunks.push({ space: pendingSpace, wordText: token.text, punct: '' });
        pendingSpace = '';
      }
      continue;
    }

    let punct = '';
    let j = i + 1;
    while (j < tokens.length && tokens[j].kind === 'punct') {
      punct += tokens[j].text;
      j++;
    }

    const order = exercise.blankByToken[i];
    chunks.push({
      space: pendingSpace,
      wordText: order === undefined ? token.text : undefined,
      blankOrder: order,
      punct,
    });
    pendingSpace = '';
    i = j - 1;
  }

  return chunks;
}
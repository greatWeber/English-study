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
    const correct =
      typed.length > 0 && normalizeWord(typed) === normalizeWord(expected);
    const { marks, extra } = diffWord(expected, typed);
    return {
      order: blank.order,
      expected,
      typed,
      correct,
      missing: typed.length === 0,
      marks,
      extra,
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
      const correct =
        typedWord.length > 0 &&
        normalizeDictationWord(typedWord) ===
          normalizeDictationWord(expectedWord);
      const { marks, extra } = diffWord(expectedWord, typedWord);
      details.push({
        order: order++,
        expected: expectedWord,
        typed: typedWord,
        correct,
        missing: typedWord.length === 0,
        marks,
        extra,
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
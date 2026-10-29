import { FUNCTION_WORDS } from "./constants";
import { Blank, CheckDetail, Exercise, Mark, Mode, RenderChunk, Token } from "./type";

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
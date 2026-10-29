/*!
 * engine.js — 纯逻辑层：拆句、挖空、判分、逐字比对。
 * 不依赖 DOM，可在浏览器和 Node 里跑（见 tests/engine.test.mjs）。
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Engine = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * 词汇表 / 常量
   * ------------------------------------------------------------------ */

  // 功能词（冠词、代词、介词、be 动词、连词…）。挖空时不优先选它们，
  // 但情态动词（should / would / can）故意保留，因为它们是很好的语法考点。
  const STOPWORDS = new Set(
    ('a an the this that these those ' +
      'i me my mine myself you your yours yourself he him his himself ' +
      'she her hers herself it its itself we us our ours ourselves ' +
      'they them their theirs themselves ' +
      'am is are was were be been being ' +
      'in on at by for with about into over after before under above below ' +
      'of to from up down out off again further then once here there ' +
      'and or but nor so yet if because as than while when where why how ' +
      'not no any some all both each few more most other own same such too very ' +
      'do does did doing have has had having will would shall should may might must ' +
      'there here also just only even still already').split(/\s+/)
  );

  // 每个等级默认挖几个空。
  const DEFAULT_BLANK_COUNT = { A1: 1, A2: 2, B1: 2, B2: 3, C1: 3, C2: 4 };

  // 单词：字母/数字，允许内部连字符和撇号（don't / well-known / 3rd）。
  const WORD_RE = /[A-Za-z0-9]+(?:['\u2019-][A-Za-z0-9]+)*/g;

  /* ------------------------------------------------------------------ *
   * 拆句
   * ------------------------------------------------------------------ */

  /**
   * 把一句话切成有序片段，保留空格与标点。
   * @returns {Array<{kind:'text'|'word', text:string}>}
   */
  function tokenize(text) {
    const items = [];
    const src = String(text == null ? '' : text);
    let cursor = 0;
    let m;
    WORD_RE.lastIndex = 0;
    while ((m = WORD_RE.exec(src)) !== null) {
      if (m.index > cursor) items.push({ kind: 'text', text: src.slice(cursor, m.index) });
      items.push({ kind: 'word', text: m[0] });
      cursor = WORD_RE.lastIndex;
    }
    if (cursor < src.length) items.push({ kind: 'text', text: src.slice(cursor) });
    return items;
  }

  function isContentWord(word) {
    const t = String(word).toLowerCase();
    if (t.length < 3) return false;
    if (STOPWORDS.has(t)) return false;
    return true;
  }

  // 候选词的得分：越长越可能被挖空（故意简单，便于解释）。
  function scoreWord(word) {
    const t = String(word);
    let s = t.length;
    if (t.length >= 8) s += 2;
    if (/[A-Z]/.test(t[0])) s += 0.5; // 句首词稍降优先级，避免老是挖第一个词
    return s;
  }

  function blankCountFor(level, wordCount) {
    let n = DEFAULT_BLANK_COUNT[level] || 2;
    if (wordCount <= 3) n = 1;
    else if (wordCount <= 5) n = Math.min(n, 2);
    return n;
  }

  /* ------------------------------------------------------------------ *
   * 生成题目
   * ------------------------------------------------------------------ */

  /**
   * @param {{text:string, level?:string, blanks?:string[]}|string} sentence
   * @param {{mode?:'fill'|'dictation', blankCount?:number}} [options]
   */
  function buildExercise(sentence, options) {
    options = options || {};
    const isString = typeof sentence === 'string';
    const text = isString ? sentence : String(sentence.text || '');
    const level = isString ? 'B1' : sentence.level || 'B1';
    const mode = options.mode === 'dictation' ? 'dictation' : 'fill';

    const items = tokenize(text);
    const wordIndexes = [];
    items.forEach((it, i) => {
      if (it.kind === 'word') wordIndexes.push(i);
    });

    const chosen = [];

    if (mode === 'dictation') {
      wordIndexes.forEach((i) => chosen.push(i));
    } else {
      const explicit = !isString && Array.isArray(sentence.blanks) ? sentence.blanks : null;
      if (explicit && explicit.length) {
        explicit.forEach((w) => {
          const target = String(w).toLowerCase();
          const hit = wordIndexes.find(
            (i) => items[i].text.toLowerCase() === target && chosen.indexOf(i) === -1
          );
          if (hit != null) chosen.push(hit);
        });
      } else {
        let count = options.blankCount != null ? options.blankCount : blankCountFor(level, wordIndexes.length);
        const content = wordIndexes.filter((i) => isContentWord(items[i].text));
        const pool = content.length ? content : wordIndexes;
        if (pool.length <= 2) count = 1;

        const ranked = pool.slice().sort((a, b) => scoreWord(items[b].text) - scoreWord(items[a].text) || a - b);

        // 第一轮：尽量不挖相邻的两个词，读起来更自然。
        ranked.forEach((idx) => {
          if (chosen.length >= count) return;
          if (chosen.some((c) => Math.abs(c - idx) <= 1)) return;
          chosen.push(idx);
        });
        // 第二轮：成语太短导致不够数时，放宽相邻限制。
        ranked.forEach((idx) => {
          if (chosen.length >= count) return;
          if (chosen.indexOf(idx) === -1) chosen.push(idx);
        });
      }
    }

    chosen.sort((a, b) => a - b);

    const blanks = chosen.map((itemIndex, order) => ({
      order,
      itemIndex,
      text: items[itemIndex].text,
      key: items[itemIndex].text.toLowerCase()
    }));

    const blankMap = new Map(blanks.map((b) => [b.itemIndex, b]));

    return {
      text,
      level,
      mode,
      items,
      blanks,
      totalLetters: blanks.reduce((n, b) => n + b.text.length, 0),
      isBlank(itemIndex) {
        return blankMap.has(itemIndex);
      },
      blankAt(itemIndex) {
        return blankMap.get(itemIndex) || null;
      }
    };
  }

  /* ------------------------------------------------------------------ *
   * 判分
   * ------------------------------------------------------------------ */

  function normalize(str) {
    return String(str == null ? '' : str)
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  /**
   * 逐字比对，返回可直接渲染的数据。
   * marks: 期望单词的每个字母 —— { ch, ok, typed }
   *   ok:true  → 这个位置写对了
   *   typed:null 且 ok:false → 漏写
   *   typed:'x' 且 ok:false → 写错（本应写 ch，实际写了 x）
   * extra: 多写出来的字母
   */
  function diffWord(expected, typed) {
    const a = normalize(expected);
    const b = normalize(typed);

    if (a === b) {
      return {
        status: a === '' ? 'empty' : 'ok',
        marks: a.split('').map((ch) => ({ ch, ok: true, typed: ch })),
        extra: []
      };
    }
    if (b === '') {
      return { status: 'missing', marks: a.split('').map((ch) => ({ ch, ok: false, typed: null })), extra: [] };
    }

    const marks = [];
    const extra = [];

    if (a.length === b.length) {
      // 长度相同 → 逐位比较，展示最直观。
      for (let i = 0; i < a.length; i++) {
        marks.push({ ch: a[i], ok: a[i] === b[i], typed: a[i] === b[i] ? a[i] : b[i] });
      }
    } else {
      // 长度不同 → 用 LCS 对齐，找出"写对的部分"。
      const n = a.length;
      const m = b.length;
      const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
      for (let i = n - 1; i >= 0; i--) {
        for (let j = m - 1; j >= 0; j--) {
          dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
        }
      }
      const matchA = new Array(n).fill(false);
      const matchB = new Array(m).fill(false);
      let i = 0;
      let j = 0;
      while (i < n && j < m) {
        if (a[i] === b[j]) {
          matchA[i] = true;
          matchB[j] = true;
          i++;
          j++;
        } else if (dp[i + 1][j] >= dp[i][j + 1]) {
          i++;
        } else {
          j++;
        }
      }
      const lostA = [];
      const lostB = [];
      for (let k = 0; k < n; k++) if (!matchA[k]) lostA.push(k);
      for (let k = 0; k < m; k++) if (!matchB[k]) lostB.push(k);
      // 把"该写没写的字母"和"多写的字母"成对配起来，UI 上就能显示成写错。
      const paired = new Map();
      for (let k = 0; k < Math.min(lostA.length, lostB.length); k++) paired.set(lostA[k], b[lostB[k]]);
      const groupedB = new Set(lostB.slice(0, lostA.length));
      for (let k = 0; k < n; k++) {
        if (matchA[k]) marks.push({ ch: a[k], ok: true, typed: a[k] });
        else marks.push({ ch: a[k], ok: false, typed: paired.has(k) ? paired.get(k) : null });
      }
      for (let k = 0; k < m; k++) {
        if (!matchB[k] && !groupedB.has(k)) extra.push(b[k]);
      }
    }

    return { status: 'wrong', marks, extra };
  }

  /**
   * @param {object} exercise buildExercise 的结果
   * @param {string[]} typedList 每个空的作答（与 exercise.blanks 同序）
   */
  function check(exercise, typedList) {
    const typed = Array.isArray(typedList) ? typedList : [];
    const results = exercise.blanks.map((blank, i) => {
      const value = typed[i] == null ? '' : String(typed[i]);
      const diff = diffWord(blank.text, value);
      return {
        order: i,
        itemIndex: blank.itemIndex,
        expected: blank.text,
        typed: value,
        supplied: normalize(value) !== '',
        status: diff.status,
        marks: diff.marks,
        extra: diff.extra
      };
    });

    const mistakes = results.filter((r) => r.status !== 'ok').length;
    return {
      correct: results.length > 0 && mistakes === 0,
      mistakes,
      answered: results.some((r) => r.supplied),
      results
    };
  }

  /* ------------------------------------------------------------------ *
   * 小工具
   * ------------------------------------------------------------------ */

  function lettersOf(word) {
    return normalize(word).split('');
  }

  function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  return {
    STOPWORDS,
    DEFAULT_BLANK_COUNT,
    tokenize,
    isContentWord,
    blankCountFor,
    buildExercise,
    diffWord,
    check,
    normalize,
    lettersOf,
    shuffle
  };
});

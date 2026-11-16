'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

export type WordQuizItem = {
  word: string;
  level: string;
  phonetic: string;
  translation: string;
};

export type WordDetail = {
  correct: boolean; // 严格正确
  lenient: boolean; // 拼写变体 / 手误（半对）
  typed: string;
};

type HistoryItem = {
  word: string;
  translation: string;
  typed: string;
  correct: boolean;
  lenient: boolean;
};

const WORD_RE = /^[A-Za-z][A-Za-z'-]*$/;

/** 与服务器同款的宽松判定，保证界面颜色和入库结果一致 */
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 2) return 99;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i += 1) {
    const cur = [i];
    for (let j = 1; j <= n; j += 1) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}

function normalizeLocal(w: string) {
  return w.toLowerCase().replace(/[^a-z']/g, '');
}

function judge(expected: string, typed: string): WordDetail {
  const e = normalizeLocal(expected);
  const t = normalizeLocal(typed);
  if (!t) return { correct: false, lenient: false, typed };
  if (e === t) return { correct: true, lenient: false, typed };
  // 英美拼写变体（-or/-our, -ize/-ise, 双写 l 等）：去噪后相同，或编辑距离 ≤1 且只差这些后缀
  const strip = (s: string) =>
    s.replace(/our$/, 'or').replace(/ise$/, 'ize').replace(/yse$/, 'yze').replace(/ll$/, 'l');
  if (strip(e) === strip(t)) return { correct: false, lenient: true, typed };
  // 手误：编辑距离 ≤2 且相对长度比例小
  const dist = editDistance(e, t);
  const ratio = dist / Math.max(e.length, t.length, 1);
  if (dist <= 2 && e.length >= 5 && ratio <= 0.34) return { correct: false, lenient: true, typed };
  return { correct: false, lenient: false, typed };
}

export function useWordPractice({ searchParams }: { searchParams: URLSearchParams }) {
  const level = searchParams.get('level') || 'all';
  const count = Math.min(Math.max(parseInt(searchParams.get('count') || '20', 10) || 20, 5), 50);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [words, setWords] = useState<WordQuizItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<'typing' | 'checked' | 'revealed' | 'summary'>('typing');
  const [typed, setTyped] = useState('');
  const [details, setDetails] = useState<Map<string, WordDetail>>(new Map());
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [celebrate, setCelebrate] = useState(0);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [revealOnWrong, setRevealOnWrong] = useState(false);
  const [wrongQueue, setWrongQueue] = useState<number[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  // 拉取本轮词表
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setLoadError('');
    fetch(`/api/words?level=${encodeURIComponent(level)}&count=${count}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok && Array.isArray(data.words) && data.words.length > 0) {
          setWords(data.words);
          setCurrentIndex(0);
          setPhase('typing');
          setTyped('');
          setDetails(new Map());
          setHistory([]);
          setWrongQueue([]);
          startTimeRef.current = Date.now();
        } else {
          setLoadError('这个等级下暂时没有可默写的单词，先去首页换个等级试试。');
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError('词表加载失败，请确认数据库已生成（npm run build:dict && npm run build:words）。');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const current = words[currentIndex];
  const totalUnits = words.length;
  const answered = history.length;
  const correctUnits = useMemo(
    () => history.filter((h) => h.correct || h.lenient).length,
    [history]
  );
  const accuracy = answered > 0 ? Math.round((correctUnits / answered) * 100) : 0;
  const progress = totalUnits > 0 ? Math.round((answered / totalUnits) * 100) : 0;
  const lastDetail = current ? details.get(current.word) : undefined;
  // 只有「完全正确」才自动进入下一题；拼写变体/手误算通过，但要用户自己确认
  const allCorrect = phase === 'checked' && !!lastDetail && lastDetail.correct;
  const accepted = phase === 'checked' && !!lastDetail && (lastDetail.correct || lastDetail.lenient);

  const focusInput = useCallback(() => {
    window.setTimeout(() => inputRef.current?.focus(), 60);
  }, []);

  // 答对：播放发音（帮助建立音-形连接），进入下一题
  const speakCurrent = useCallback((word: string) => {
    try {
      const audio = new Audio(
        `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`
      );
      audio.volume = 0.9;
      void audio.play().catch(() => undefined);
    } catch {
      /* 忽略 */
    }
  }, []);

  // 出题即读：单词一出现就自动发音，不再等答对
  useEffect(() => {
    if (!autoSpeak || phase !== 'typing' || !current?.word) return;
    speakCurrent(current.word);
    // 重做本题（phase 重新变回 typing）时也会再读一遍
  }, [autoSpeak, phase, currentIndex, current?.word, speakCurrent]);

  const saveToServer = useCallback((items: HistoryItem[]) => {
    void fetch('/api/words', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ words: items.map((i) => ({ word: i.word, typed: i.typed, timeSpent: 1 })) }),
    }).catch(() => undefined);
  }, []);

  const finishRound = useCallback(
    (finalHistory: HistoryItem[]) => {
      setPhase('summary');
      if (finalHistory.length > 0) saveToServer(finalHistory);
    },
    [saveToServer]
  );

  const handleCheck = useCallback(() => {
    if (!current || phase !== 'typing') return;
    const detail = judge(current.word, typed);
    setDetails((prev) => new Map(prev).set(current.word, detail));
    const passed = detail.correct || detail.lenient;
    const nextHistory = [
      ...history,
      {
        word: current.word,
        translation: current.translation,
        typed,
        correct: detail.correct,
        lenient: detail.lenient,
      },
    ];
    setHistory(nextHistory);
    if (passed) {
      if (detail.correct) setCelebrate((n) => n + 1);
    } else {
      setWrongQueue((q) => (q.includes(currentIndex) ? q : [...q, currentIndex]));
    }
    setPhase('checked');
  }, [current, phase, typed, history, currentIndex]);

  const goNext = useCallback(() => {
    if (words.length === 0) return;
    // 还有下一词 → 继续；否则进入小结
    if (currentIndex + 1 < words.length) {
      setCurrentIndex((i) => i + 1);
      setTyped('');
      setPhase('typing');
      focusInput();
    } else {
      finishRound(history);
    }
  }, [words.length, currentIndex, history, finishRound, focusInput]);

  const handleReveal = useCallback(() => {
    if (!current || phase === 'summary') return;
    setPhase('revealed');
  }, [current, phase]);

  // 重做本题（清空当前输入），答错时使用
  const resetQuestion = useCallback(() => {
    if (!current) return;
    setDetails((prev) => {
      const next = new Map(prev);
      next.delete(current.word);
      return next;
    });
    setHistory((h) => h.filter((item) => item.word !== current.word));
    setWrongQueue((q) => q.filter((i) => i !== currentIndex));
    setTyped('');
    setPhase('typing');
    focusInput();
  }, [current, currentIndex, focusInput]);

  // 错题重练：只练这一轮答错的词
  const retryWrong = useCallback(() => {
    if (wrongQueue.length === 0) return;
    const wrongWords = wrongQueue.map((i) => words[i]).filter(Boolean);
    setWords(wrongWords);
    setCurrentIndex(0);
    setTyped('');
    setDetails(new Map());
    setHistory([]);
    setWrongQueue([]);
    setPhase('typing');
    focusInput();
  }, [wrongQueue, words, focusInput]);

  const finishEarly = useCallback(() => {
    finishRound(history);
  }, [finishRound, history]);

  // 批改后自动流转：答对稍作停留自动下一题；答错可自动揭示答案
  useEffect(() => {
    if (phase !== 'checked') return;
    if (allCorrect) {
      const timer = window.setTimeout(() => {
        if (currentIndex + 1 < words.length) {
          setCurrentIndex((i) => i + 1);
          setTyped('');
          setPhase('typing');
          focusInput();
        } else {
          setHistory((h) => {
            finishRound(h);
            return h;
          });
        }
      }, 1100);
      return () => window.clearTimeout(timer);
    }
    if (revealOnWrong) {
      const timer = window.setTimeout(() => setPhase('revealed'), 1200);
      return () => window.clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // 全局快捷键
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      const inField = tag === 'INPUT' || tag === 'TEXTAREA';

      if (event.key === 'Enter') {
        if (phase === 'typing' && (inField || tag === 'BODY')) {
          event.preventDefault();
          handleCheck();
          return;
        }
        if (phase === 'revealed' || (phase === 'checked' && accepted)) {
          event.preventDefault();
          goNext();
          return;
        }
        if (phase === 'checked' && !accepted) {
          event.preventDefault();
          resetQuestion();
          return;
        }
      }
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        if (phase === 'typing') handleReveal();
        else if (phase === 'revealed' || (phase === 'checked' && accepted)) goNext();
        return;
      }
      if (event.key === 'Escape') {
        if (phase === 'checked' || phase === 'revealed') {
          event.preventDefault();
          resetQuestion();
        }
        return;
      }
      // 直接敲字母 → 落进输入框（输入框已聚焦时浏览器原生处理）
      if (phase === 'typing' && !inField && !event.metaKey && !event.ctrlKey && !event.altKey) {
        if (/^[A-Za-z]$/.test(event.key)) {
          setTyped((t) => t + event.key);
          setPhase((p) => (p === 'typing' ? p : p));
          focusInput();
          event.preventDefault();
        } else if (event.key === 'Backspace') {
          setTyped((t) => t.slice(0, -1));
          event.preventDefault();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [phase, accepted, handleCheck, goNext, handleReveal, resetQuestion, focusInput]);

  // 首次进入聚焦
  useEffect(() => {
    if (!loading && current) focusInput();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, words.length]);

  // 每题开始计时（目前粗粒度记录 1，保留 hook）
  useEffect(() => {
    startTimeRef.current = Date.now();
  }, [currentIndex]);

  const backHref = `/?content=word&level=${encodeURIComponent(level)}`;

  return {
    loading,
    loadError,
    level,
    count,
    words,
    currentIndex,
    phase,
    typed,
    setTyped,
    current,
    lastDetail,
    details,
    history,
    celebrate,
    autoSpeak,
    setAutoSpeak,
    revealOnWrong,
    setRevealOnWrong,
    wrongQueue,
    totalUnits,
    answered,
    correctUnits,
    accuracy,
    progress,
    allCorrect,
    inputRef,
    handleCheck,
    goNext,
    handleReveal,
    resetQuestion,
    retryWrong,
    finishEarly,
    speakCurrent,
    backHref,
  };
}

export type WordPracticeApi = ReturnType<typeof useWordPractice>;

export { WORD_RE };

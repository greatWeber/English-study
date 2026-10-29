'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  Flag,
  Home,
  Languages,
  Lightbulb,
  RotateCcw,
  Star,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { CATEGORIES, type Sentence } from '@/lib/constants';

/* ============================================================
   类型 & 判分引擎（前端）
   ============================================================ */

type Mode = 'fill' | 'dictation';
type Phase = 'typing' | 'checked' | 'revealed' | 'summary';

type Token = { kind: 'word' | 'space' | 'punct'; text: string };

type Blank = {
  order: number;
  tokenIndex: number;
  answer: string;
};

type Exercise = {
  tokens: Token[];
  blanks: Blank[];
  blankByToken: Record<number, number>;
};

type Mark = { ch: string; ok: boolean };

type CheckDetail = {
  order: number;
  expected: string;
  typed: string;
  correct: boolean;
  missing: boolean;
  marks: Mark[];
  extra: string[];
};

type Attempt = {
  sentenceId: string;
  text: string;
  zh?: string | null;
  correct: boolean;
  mistakes: number;
  details: CheckDetail[];
};

type Toast = { msg: string; type: 'ok' | 'warn' };

function tokenize(text: string) {
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

const FUNCTION_WORDS = new Set([
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

function isContentWord(w: string) {
  const lw = w.toLowerCase();
  if (FUNCTION_WORDS.has(lw)) return false;
  return /^[A-Za-z']+$/.test(lw);
}

function normalizeWord(w: string) {
  return w.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z']/g, '');
}

function parseCuratedBlanks(raw: unknown): string[] {
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

function buildExercise(text: string, mode: Mode, curatedRaw: unknown): Exercise {
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

function diffWord(expected: string, typed: string) {
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

function checkBlanks(exercise: Exercise, typedWords: string[]): CheckDetail[] {
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

function buildTypedSentence(exercise: Exercise, typedWords: string[]) {
  return exercise.tokens
    .map((token, index) => {
      const order = exercise.blankByToken[index];
      if (order === undefined) return token.text;
      return (typedWords[order] ?? '').trim() || '___';
    })
    .join('');
}

/* ============================================================
   页面
   ============================================================ */

function SearchParamsWrapper({
  children,
}: {
  children: (params: URLSearchParams) => React.ReactNode;
}) {
  const searchParams = useSearchParams();
  return <>{children(searchParams)}</>;
}

function PracticePageContent({ searchParams }: { searchParams: URLSearchParams }) {
  const router = useRouter();

  const dataset = searchParams.get('dataset') || 'builtin';
  const level = searchParams.get('level') || 'all';
  const category = searchParams.get('category') || 'all';
  const mode: Mode = searchParams.get('mode') === 'dictation' ? 'dictation' : 'fill';

  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('typing');
  const [typedWords, setTypedWords] = useState<string[]>([]);
  const [checkDetails, setCheckDetails] = useState<CheckDetail[]>([]);
  const [history, setHistory] = useState<Attempt[]>([]);
  const [showZh, setShowZh] = useState(false);
  const [hintLetters, setHintLetters] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [activeBlank, setActiveBlank] = useState(0);
  const [celebrate, setCelebrate] = useState(0);

  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const startedAtRef = useRef<number>(Date.now());

  const current = sentences[currentIndex];
  const exercise = useMemo(
    () => (current ? buildExercise(current.text, mode, current.blanks) : null),
    [current, mode],
  );

  const detailByOrder = useMemo(() => {
    const map = new Map<number, CheckDetail>();
    checkDetails.forEach((detail) => map.set(detail.order, detail));
    return map;
  }, [checkDetails]);

  /* ---------------- 数据加载 ---------------- */

  useEffect(() => {
    let cancelled = false;
    let url = `/api/sentences?datasetId=${encodeURIComponent(dataset)}&limit=50`;
    if (level !== 'all') url += `&level=${encodeURIComponent(level)}`;
    if (category !== 'all') url += `&category=${encodeURIComponent(category)}`;
    if (reviewMode) url += '&excludeMastered=1';

    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((data: { ok?: boolean; sentences?: Sentence[] }) => {
        if (cancelled) return;
        if (data.ok && data.sentences) {
          setSentences(data.sentences);
          setCurrentIndex(0);
          setHistory([]);
          setCheckDetails([]);
          setTypedWords([]);
          setPhase('typing');
        }
        setLoading(false);
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [dataset, level, category, mode, reviewMode]);

  /* ---------------- 每题初始化 ---------------- */

  useEffect(() => {
    if (!exercise) return;
    setTypedWords(Array(exercise.blanks.length).fill(''));
    setCheckDetails([]);
    setPhase('typing');
    setActiveBlank(0);
    setShowZh(false);
    startedAtRef.current = Date.now();
  }, [exercise]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /* ---------------- 焦点 / 输入 ---------------- */

  const registerInput = useCallback((order: number, el: HTMLInputElement | null) => {
    if (el) inputRefs.current.set(order, el);
    else inputRefs.current.delete(order);
  }, []);

  const focusBlank = useCallback((order: number) => {
    const el = inputRefs.current.get(order);
    if (!el) return;
    el.focus();
    setActiveBlank(order);
    window.requestAnimationFrame(() => {
      const len = el.value.length;
      try {
        el.setSelectionRange(len, len);
      } catch {
        /* 忽略浏览器差异 */
      }
    });
  }, []);

  // 新题出现后自动把光标放进第一个空，键盘一按就能写
  useEffect(() => {
    if (phase !== 'typing' || !exercise) return;
    const timer = window.setTimeout(() => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement) return;
      focusBlank(0);
    }, 90);
    return () => window.clearTimeout(timer);
  }, [exercise, phase, focusBlank]);

  const handleInputChange = useCallback(
    (order: number, raw: string) => {
      if (phase !== 'typing') return;
      const hasSpace = /\s/.test(raw);
      const cleaned = raw.replace(/\s+/g, '');
      setTypedWords((prev) => {
        const next = [...prev];
        next[order] = cleaned;
        return next;
      });
      if (hasSpace && exercise && order + 1 < exercise.blanks.length) {
        window.setTimeout(() => focusBlank(order + 1), 0);
      }
    },
    [phase, exercise, focusBlank],
  );

  const resetQuestion = useCallback(() => {
    if (!exercise) return;
    setTypedWords(Array(exercise.blanks.length).fill(''));
    setCheckDetails([]);
    setPhase('typing');
    setActiveBlank(0);
    startedAtRef.current = Date.now();
    window.setTimeout(() => focusBlank(0), 60);
  }, [exercise, focusBlank]);

  const handleCheck = useCallback(() => {
    if (!current || !exercise || phase !== 'typing') return;

    if (typedWords.every((word) => !word.trim())) {
      setToast({ msg: '先写点什么再检查吧～', type: 'warn' });
      focusBlank(0);
      return;
    }

    const details = checkBlanks(exercise, typedWords);
    const mistakes = details.filter((detail) => !detail.correct).length;
    const overallCorrect = mistakes === 0;

    setCheckDetails(details);
    setPhase('checked');
    setShowZh(true);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    if (overallCorrect) setCelebrate((n) => n + 1);

    setHistory((prev) => [
      ...prev,
      {
        sentenceId: current.id,
        text: current.text,
        zh: current.zh,
        correct: overallCorrect,
        mistakes,
        details,
      },
    ]);

    fetch('/api/records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sentenceId: current.id,
        datasetId: current.dataset_id,
        mode,
        correct: overallCorrect,
        mistakes,
        timeSpent: Math.max(
          1,
          Math.round((Date.now() - startedAtRef.current) / 1000),
        ),
        typedText: buildTypedSentence(exercise, typedWords),
      }),
    }).catch(() => {
      /* 记录失败不打断练习 */
    });
  }, [current, exercise, phase, typedWords, mode, focusBlank]);

  const handleBlankKeyDown = useCallback(
    (order: number, event: React.KeyboardEvent<HTMLInputElement>) => {
      if (phase !== 'typing') return;
      const input = event.currentTarget;
      const total = exercise?.blanks.length ?? 0;

      if (event.key === 'Enter') {
        // ⌘/Ctrl + Enter 交给全局快捷键处理（看答案）
        if (event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        handleCheck();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        resetQuestion();
        return;
      }
      if (event.key === 'Tab') {
        event.preventDefault();
        const next = Math.min(Math.max(order + (event.shiftKey ? -1 : 1), 0), total - 1);
        focusBlank(next);
        return;
      }
      if (event.key === ' ') {
        event.preventDefault();
        if (order + 1 < total) focusBlank(order + 1);
        return;
      }
      if (
        event.key === 'ArrowRight' &&
        input.selectionStart === input.value.length &&
        order + 1 < total
      ) {
        event.preventDefault();
        focusBlank(order + 1);
        return;
      }
      if (event.key === 'ArrowLeft' && input.selectionStart === 0 && order > 0) {
        event.preventDefault();
        focusBlank(order - 1);
        return;
      }
      if (event.key === 'Backspace' && input.value === '' && order > 0) {
        event.preventDefault();
        focusBlank(order - 1);
      }
    },
    [phase, exercise, handleCheck, resetQuestion, focusBlank],
  );

  const handleNext = useCallback(() => {
    if (currentIndex + 1 >= sentences.length) {
      setPhase('summary');
      return;
    }
    // 先清掉上一题的批改结果，避免切换瞬间闪出旧的对错标记
    setTypedWords([]);
    setCheckDetails([]);
    setShowZh(false);
    setPhase('typing');
    startedAtRef.current = Date.now();
    setCurrentIndex((index) => index + 1);
  }, [currentIndex, sentences.length]);

  const handleReveal = useCallback(() => {
    setPhase('revealed');
    setShowZh(true);
    setCheckDetails([]);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }, []);

  const startRound = useCallback(() => {
    setHistory([]);
    setCheckDetails([]);
    setTypedWords(exercise ? Array(exercise.blanks.length).fill('') : []);
    setPhase('typing');
    setActiveBlank(0);
    setShowZh(false);
    setCelebrate(0);
    startedAtRef.current = Date.now();

    if (currentIndex !== 0) {
      setCurrentIndex(0);
    } else {
      window.setTimeout(() => focusBlank(0), 80);
    }
  }, [exercise, currentIndex, focusBlank]);

  const finishEarly = useCallback(() => {
    if (history.length === 0) {
      setToast({ msg: '还没有答题记录，先做一题吧～', type: 'warn' });
      return;
    }
    setPhase('summary');
  }, [history.length]);

  /* ---------------- 全局快捷键 ---------------- */

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable =
        !!target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable);
      const isInteractive =
        !!target &&
        typeof target.closest === 'function' &&
        !!target.closest('button, a, [role="button"]');

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'h') {
        event.preventDefault();
        setHintLetters((value) => !value);
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
        event.preventDefault();
        if (phase === 'typing') handleReveal();
        else if (phase === 'checked' || phase === 'revealed') handleNext();
        return;
      }

      if (event.key === 'Enter' && !isEditable && !isInteractive) {
        if (phase === 'checked' || phase === 'revealed') {
          event.preventDefault();
          handleNext();
        }
        return;
      }

      if (event.key === 'Escape' && phase === 'typing') {
        event.preventDefault();
        resetQuestion();
        return;
      }

      // 兜底：即使焦点不在输入框里，直接敲字母也能写进当前空
      if (
        phase === 'typing' &&
        !isEditable &&
        !isInteractive &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.isComposing &&
        event.key.length === 1
      ) {
        const total = exercise?.blanks.length ?? 0;
        if (total === 0) return;
        const order = Math.min(activeBlank, total - 1);

        if (event.key === ' ') {
          event.preventDefault();
          if (order + 1 < total) focusBlank(order + 1);
          return;
        }

        event.preventDefault();
        setTypedWords((prev) => {
          const next = [...prev];
          next[order] = (next[order] ?? '') + event.key;
          return next;
        });
        focusBlank(order);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    phase,
    activeBlank,
    exercise,
    focusBlank,
    handleNext,
    handleReveal,
    resetQuestion,
  ]);

  /* ---------------- 派生状态 ---------------- */

  const totalBlanks = exercise?.blanks.length ?? 0;
  const filledCount = typedWords.filter((word) => word.trim()).length;
  const attempts = history.length;
  const correctAttempts = history.filter((attempt) => attempt.correct).length;
  const accuracy = attempts > 0 ? Math.round((correctAttempts / attempts) * 100) : 0;
  const allCorrect =
    phase === 'checked' &&
    checkDetails.length > 0 &&
    checkDetails.every((detail) => detail.correct);
  const mistakes = checkDetails.filter((detail) => !detail.correct).length;
  const progress = sentences.length
    ? Math.min(((currentIndex + 1) / sentences.length) * 100, 100)
    : 0;

  const categoryMeta = CATEGORIES.find((item) => item.id === current?.category);
  const levelColor: Record<string, string> = {
    A1: 'bg-cartoon-mint',
    A2: 'bg-cloud',
    B1: 'bg-grape',
    B2: 'bg-cartoon-orange',
    C1: 'bg-cartoon-coral',
    C2: 'bg-[#F9A8D4]',
  };

  const wrongWords = useMemo(() => {
    const map = new Map<string, { expected: string; typed: string }>();
    history.forEach((attempt) => {
      attempt.details.forEach((detail) => {
        if (!detail.correct) {
          map.set(detail.expected.toLowerCase(), {
            expected: detail.expected,
            typed: detail.typed,
          });
        }
      });
    });
    return Array.from(map.values());
  }, [history]);

  const tip = (() => {
    if (phase === 'checked') {
      return allCorrect
        ? '全对！你的拼写闪闪发光，继续保持 ✨'
        : `就差一点点，${mistakes} 个空看看下面的小报告～`;
    }
    if (phase === 'revealed') return '答案已经亮出来啦，记一记，下一题一定行！';
    if (hintLetters) return '首字母偷偷露出头啦，顺着往下写～';
    if (filledCount === 0) return '点一下彩色下划线，把缺的单词写进去吧！';
    if (filledCount < totalBlanks) return `已经填好 ${filledCount} / ${totalBlanks} 个空啦，继续加油！`;
    return '每个空都填好了，按 Enter 检查一下？';
  })();

  const backHref = `/?dataset=${encodeURIComponent(dataset)}&level=${encodeURIComponent(level)}&category=${encodeURIComponent(category)}&mode=${mode}`;

  /* ---------------- 加载 / 空状态 ---------------- */

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream font-cartoon text-ink">
        <BackgroundDecor />
        <div className="relative z-10 flex flex-col items-center gap-5">
          <Mascot className="h-24 w-24 animate-float" />
          <div className="rounded-2xl border-[3px] border-ink bg-white px-6 py-3 text-sm font-extrabold shadow-[4px_4px_0_0_#2B2B45]">
            正在翻开练习本…
          </div>
        </div>
      </div>
    );
  }

  if (sentences.length === 0) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream px-4 font-cartoon text-ink">
        <BackgroundDecor />
        <div className="ink-card relative z-10 max-w-md p-8 text-center">
          <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-3xl border-[3px] border-ink bg-lemon text-4xl shadow-[4px_4px_0_0_#2B2B45]">
            📭
          </div>
          <h2 className="text-2xl font-extrabold">这一格还没有题目</h2>
          <p className="mt-2 text-sm font-semibold text-ink/55">
            换个等级或场景试试，或者先导入一些语料吧～
          </p>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="ink-btn ink-btn-primary mt-6 w-full py-3.5"
          >
            回选题页 <ArrowRight size={18} strokeWidth={3} />
          </button>
        </div>
      </div>
    );
  }

  /* ---------------- 主界面 ---------------- */

  return (
    <div className="relative min-h-screen overflow-hidden bg-cream font-cartoon text-ink">
      <BackgroundDecor />

      <header className="relative z-20 mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-5 md:px-6">
        <Link href={backHref} className="group flex items-center gap-3">
          <span className="grid h-12 w-12 -rotate-3 place-items-center rounded-2xl border-[3px] border-ink bg-lemon shadow-[3px_3px_0_0_#2B2B45] transition-transform group-hover:rotate-0">
            <Mascot className="h-9 w-9" />
          </span>
          <span>
            <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-ink/40">
              Dictation Fun
            </span>
            <span className="block text-lg font-extrabold leading-tight md:text-xl">
              {mode === 'fill' ? '句子填空大冒险' : '整句默写挑战'}
            </span>
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setReviewMode((value) => !value)}
            aria-pressed={reviewMode}
            className={`ink-btn px-3 py-2 text-xs ${
              reviewMode ? 'bg-cartoon-coral text-white' : 'ink-btn-white'
            }`}
          >
            <Star
              size={15}
              strokeWidth={3}
              fill={reviewMode ? 'currentColor' : 'none'}
            />
            {reviewMode ? '复习模式' : '错题复习'}
          </button>
          <Link
            href="/"
            className="ink-btn ink-btn-white px-3 py-2 text-xs"
          >
            <Home size={15} strokeWidth={3} />
            回首页
          </Link>
        </div>
      </header>

      <main className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-16 pt-3 md:px-6">
        {phase === 'summary' ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="ink-pill border-ink bg-lemon shadow-[2px_2px_0_0_#2B2B45]">
                📊 本轮战绩
              </span>
              <button
                type="button"
                onClick={() => router.push('/')}
                className="text-xs font-extrabold text-ink/45 underline decoration-dotted decoration-2 underline-offset-4 hover:text-ink"
              >
                返回选题页
              </button>
            </div>

            <section className="ink-card relative overflow-hidden p-6 text-center md:p-10">
              <Confetti run={1} active={attempts > 0} />
              <Mascot className="mx-auto h-28 w-28 animate-float" />
              <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">
                本轮通关啦 🎉
              </h2>
              <p className="mt-2 text-sm font-bold text-ink/55">
                {attempts === 0
                  ? '还没有答题记录，下次一定！'
                  : correctAttempts === attempts
                    ? '满分战绩！你的拼写本在发光 ✨'
                    : '每订正一次，就离满分更近一步 💪'}
              </p>

              <div className="mx-auto mt-6 grid max-w-2xl grid-cols-3 gap-3">
                {[
                  { label: '答题次数', value: attempts, bg: 'bg-[#EEF6FF]' },
                  { label: '全对次数', value: correctAttempts, bg: 'bg-cartoon-mint/60' },
                  { label: '正确率', value: attempts > 0 ? `${accuracy}%` : '—', bg: 'bg-lemon/80' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className={`rounded-2xl border-[3px] border-ink ${item.bg} px-2 py-4 shadow-[3px_3px_0_0_#2B2B45]`}
                  >
                    <div className="text-2xl font-black md:text-3xl">{item.value}</div>
                    <div className="mt-1 text-[10px] font-extrabold text-ink/50 md:text-xs">
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mx-auto mt-6 max-w-2xl rounded-2xl border-[3px] border-dashed border-ink/25 bg-[#FFFDF7] p-4 text-left">
                <p className="flex items-center gap-2 text-sm font-extrabold">
                  <span className="text-lg">📝</span> 错词小本本
                </p>
                {wrongWords.length === 0 ? (
                  <p className="mt-2 text-sm font-bold text-ink/50">
                    这轮没有错词，太厉害了！
                  </p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {wrongWords.map((word) => (
                      <span
                        key={word.expected.toLowerCase()}
                        className="ink-pill gap-2 border-ink/25 bg-white py-1.5 text-[11px]"
                      >
                        <span className="text-red-500 line-through decoration-2">
                          {word.typed || '空着'}
                        </span>
                        <ArrowRight size={11} strokeWidth={3} className="text-ink/35" />
                        <span className="text-green-700">{word.expected}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mx-auto mt-7 flex max-w-2xl flex-col gap-3 sm:flex-row">
                <button
                  type="button"
                  onClick={startRound}
                  className="ink-btn ink-btn-primary flex-1 py-3.5 text-base"
                >
                  <RotateCcw size={18} strokeWidth={3} /> 再练一轮
                </button>
                <Link
                  href="/review"
                  className="ink-btn ink-btn-white flex-1 py-3.5 text-base"
                >
                  <Star size={18} strokeWidth={3} /> 错题复习本
                </Link>
                <Link
                  href="/"
                  className="ink-btn ink-btn-white flex-1 py-3.5 text-base"
                >
                  <Home size={18} strokeWidth={3} /> 回首页
                </Link>
              </div>
            </section>
          </>
        ) : (
          <>
            {/* 进度 */}
            <div className="mb-4 flex items-center gap-3">
              <div className="flex shrink-0 items-center gap-2 rounded-full border-[3px] border-ink bg-white px-3 py-1.5 text-xs font-extrabold shadow-[3px_3px_0_0_#2B2B45]">
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[10px] text-white">
                  {currentIndex + 1}
                </span>
                <span className="hidden sm:inline">/ {sentences.length} 题</span>
                <span className="sm:hidden">/{sentences.length}</span>
              </div>

              <div className="relative flex-1">
                <div className="h-4 overflow-hidden rounded-full border-[3px] border-ink bg-white">
                  <div
                    className="h-full rounded-full bg-[repeating-linear-gradient(45deg,#FFB26B_0px,#FFB26B_9px,#FFD166_9px,#FFD166_18px)] transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span
                  className="absolute -top-2.5 text-lg drop-shadow-[1px_1px_0_#fff] transition-all duration-300"
                  style={{ left: `calc(${Math.min(Math.max(progress, 3), 97)}% - 9px)` }}
                >
                  ✏️
                </span>
              </div>

              <div className="hidden shrink-0 items-center gap-1 rounded-full border-[3px] border-ink bg-white px-3 py-1.5 text-xs font-extrabold shadow-[3px_3px_0_0_#2B2B45] sm:flex">
                ⭐ {correctAttempts}
              </div>

              <button
                type="button"
                onClick={finishEarly}
                className="ink-btn ink-btn-white inline-flex px-2.5 py-1.5 text-[11px]"
                title="结束本轮并查看战绩"
              >
                <Flag size={13} strokeWidth={3} />
                <span className="hidden sm:inline">交卷</span>
              </button>
            </div>

            {/* 小老师提示 */}
            <div className="mb-4 flex items-end gap-2.5">
              <Mascot className="mb-1 h-16 w-16 shrink-0 animate-float md:h-20 md:w-20" />
              <div className="relative flex-1 rounded-2xl rounded-bl-md border-[3px] border-ink bg-white px-4 py-2.5 shadow-[4px_4px_0_0_#2B2B45]">
                <p className="text-sm font-extrabold leading-snug md:text-[15px]">{tip}</p>
                <span className="absolute -left-1 bottom-2 h-3 w-3 rotate-45 border-b-[3px] border-l-[3px] border-ink bg-white" />
              </div>
            </div>

            {/* 句子填空主卡 */}
            <section className="ink-card relative overflow-hidden">
              <Confetti run={celebrate} active={allCorrect} />

              <div className="flex flex-wrap items-center justify-between gap-2 border-b-[3px] border-ink bg-lemon px-4 py-2.5 md:px-6">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="ink-pill bg-white text-[10px] uppercase tracking-widest">
                    ✏️ {mode === 'fill' ? 'Fill in' : 'Dictation'}
                  </span>
                  {current && (
                    <span
                      className={`ink-pill ${
                        levelColor[current.level] ?? 'bg-white'
                      } text-[10px]`}
                    >
                      {current.level}
                    </span>
                  )}
                  {categoryMeta && (
                    <span className="ink-pill border-ink/20 bg-white/85 text-[10px]">
                      {categoryMeta.icon} {categoryMeta.label}
                    </span>
                  )}
                </div>
                <span className="flex items-center gap-1.5 text-[11px] font-extrabold text-ink/55">
                  <span className="inline-block h-2 w-2 rounded-full bg-cartoon-orange" />
                  {phase === 'typing'
                    ? `${totalBlanks} 个空 · 点下划线输入`
                    : phase === 'checked'
                      ? `${totalBlanks - mistakes} / ${totalBlanks} 个空写对`
                      : '答案已亮出'}
                </span>
              </div>

              <div className="relative overflow-hidden bg-[#FFFDF7] px-3 py-9 md:px-10 md:py-12">
                <div className="paper-dots absolute inset-0 opacity-40" />

                <div className="relative z-10 mx-auto text-center text-[25px] font-bold leading-[2.15] md:text-[33px]">
                  {exercise &&
                    buildChunks(exercise).map((chunk, index) => (
                      <span key={`chunk-${index}`}>
                        {chunk.space ? ' ' : null}
                        <span className="inline-block align-middle">
                          {chunk.blankOrder !== undefined ? (
                            <BlankSlot
                              answer={exercise.blanks[chunk.blankOrder].answer}
                              typed={typedWords[chunk.blankOrder] ?? ''}
                              order={chunk.blankOrder}
                              phase={phase}
                              active={activeBlank === chunk.blankOrder}
                              hint={hintLetters}
                              detail={detailByOrder.get(chunk.blankOrder)}
                              punctuation={chunk.punct}
                              registerInput={registerInput}
                              onFocus={setActiveBlank}
                              onChange={handleInputChange}
                              onKeyDown={handleBlankKeyDown}
                            />
                          ) : (
                            <span className="whitespace-nowrap">
                              {chunk.wordText}
                              <span className="text-ink/40">{chunk.punct}</span>
                            </span>
                          )}
                        </span>
                      </span>
                    ))}
                </div>

                <AnimatePresence initial={false}>
                  {showZh && current?.zh && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="relative z-10 mx-auto mt-6 flex max-w-xl items-start justify-center gap-2 rounded-2xl border-2 border-dashed border-ink/25 bg-white/85 px-4 py-2.5 text-center text-sm font-bold leading-relaxed text-ink/65"
                    >
                      <Languages size={16} strokeWidth={2.5} className="mt-0.5 shrink-0" />
                      <span>{current.zh}</span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t-[3px] border-dashed border-ink/15 bg-white px-4 py-2.5 md:px-6">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setHintLetters((value) => !value);
                      if (phase === 'typing') {
                        window.setTimeout(() => focusBlank(activeBlank), 0);
                      }
                    }}
                    aria-pressed={hintLetters}
                    className={`ink-pill gap-1.5 border-2 py-1.5 transition-all ${
                      hintLetters
                        ? 'bg-lemon shadow-[2px_2px_0_0_#2B2B45]'
                        : 'bg-white hover:bg-[#FFF6D6]'
                    }`}
                  >
                    <Lightbulb size={13} strokeWidth={3} />
                    首字母 <kbd className="text-[9px] opacity-50">⌘H</kbd>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowZh((value) => !value);
                      if (phase === 'typing') {
                        window.setTimeout(() => focusBlank(activeBlank), 0);
                      }
                    }}
                    aria-pressed={showZh}
                    className={`ink-pill gap-1.5 border-2 py-1.5 transition-all ${
                      showZh
                        ? 'bg-cloud/60 shadow-[2px_2px_0_0_#2B2B45]'
                        : 'bg-white hover:bg-[#EEF6FF]'
                    }`}
                  >
                    <Languages size={13} strokeWidth={3} />
                    中文
                  </button>
                </div>
                <p className="text-[11px] font-bold text-ink/40">
                  Tab / 空格 跳下一空 · Enter 检查
                </p>
              </div>
            </section>

            {/* 判分反馈 */}
            <AnimatePresence initial={false}>
              {phase === 'checked' && (
                <motion.div
                  key="feedback"
                  initial={{ opacity: 0, y: -8, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={`mt-4 flex items-center gap-3 rounded-2xl border-[3px] border-ink px-4 py-3 shadow-[4px_4px_0_0_#2B2B45] ${
                    allCorrect ? 'bg-cartoon-mint' : 'bg-[#FFE3E3]'
                  }`}
                  role="status"
                  aria-live="polite"
                >
                  <span className="text-3xl">{allCorrect ? '🎉' : '💪'}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-extrabold md:text-base">
                      {allCorrect
                        ? '全对！这一题漂亮拿下'
                        : `还差一点点，有 ${mistakes} 个空需要订正`}
                    </p>
                    <p className="text-[11px] font-bold text-ink/55 md:text-xs">
                      {allCorrect
                        ? '按 Enter 直接进入下一题'
                        : '看看下面的批改小报告，再试一次也可以'}
                    </p>
                  </div>
                  {allCorrect ? (
                    <CheckCircle2
                      size={30}
                      strokeWidth={2.5}
                      className="ml-auto shrink-0 text-green-600"
                    />
                  ) : (
                    <XCircleIcon className="ml-auto h-7 w-7 shrink-0 text-red-500" />
                  )}
                </motion.div>
              )}

              {phase === 'revealed' && (
                <motion.div
                  key="revealed"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border-[3px] border-ink bg-cloud/40 px-4 py-3 shadow-[4px_4px_0_0_#2B2B45]"
                >
                  <span className="text-2xl">💡</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-extrabold">答案已经全部填好啦</p>
                    <p className="text-[11px] font-bold text-ink/55">
                      大声读一遍，再进入下一题吧～
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (current) {
                        navigator.clipboard?.writeText(current.text).catch(() => {
                          /* 忽略复制失败 */
                        });
                        setToast({ msg: '已复制完整句子 📋', type: 'ok' });
                      }
                    }}
                    className="ink-btn ink-btn-white px-3 py-1.5 text-[11px]"
                  >
                    复制句子
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* 操作按钮 */}
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              {phase === 'typing' && (
                <>
                  <button
                    type="button"
                    onClick={handleCheck}
                    disabled={filledCount === 0}
                    className="ink-btn ink-btn-primary flex-1 py-4 text-base"
                  >
                    <CheckCircle2 size={20} strokeWidth={3} />
                    检查答案
                    <kbd className="ml-1 rounded-lg border-2 border-white/50 px-1.5 py-0.5 text-[10px] font-black">
                      Enter
                    </kbd>
                  </button>
                  <button
                    type="button"
                    onClick={resetQuestion}
                    className="ink-btn ink-btn-white px-4 py-4 sm:px-5"
                  >
                    <RotateCcw size={17} strokeWidth={3} /> 重做
                  </button>
                  <button
                    type="button"
                    onClick={handleReveal}
                    className="ink-btn ink-btn-white px-4 py-4 sm:px-5"
                  >
                    <Eye size={17} strokeWidth={3} /> 看答案
                  </button>
                </>
              )}

              {(phase === 'checked' || phase === 'revealed') && (
                <>
                  <button
                    type="button"
                    onClick={handleNext}
                    className="ink-btn ink-btn-primary flex-1 py-4 text-base"
                  >
                    下一题 <ArrowRight size={20} strokeWidth={3} />
                    <kbd className="ml-1 rounded-lg border-2 border-white/50 px-1.5 py-0.5 text-[10px] font-black">
                      Enter
                    </kbd>
                  </button>
                  {phase === 'checked' && (
                    <button
                      type="button"
                      onClick={resetQuestion}
                      className="ink-btn ink-btn-white px-4 py-4 sm:px-5"
                    >
                      <RotateCcw size={17} strokeWidth={3} /> 再试一次
                    </button>
                  )}
                  {phase === 'revealed' && (
                    <button
                      type="button"
                      onClick={resetQuestion}
                      className="ink-btn ink-btn-white px-4 py-4 sm:px-5"
                    >
                      <RotateCcw size={17} strokeWidth={3} /> 自己写一遍
                    </button>
                  )}
                </>
              )}
            </div>

            {/* 批改小报告 */}
            <AnimatePresence initial={false}>
              {phase === 'checked' && mistakes > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="ink-card mt-5 p-5"
                >
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-xl border-2 border-ink bg-[#FFE3E3] text-sm shadow-[2px_2px_0_0_#2B2B45]">
                      📝
                    </span>
                    <div>
                      <h3 className="text-sm font-extrabold">批改小报告</h3>
                      <p className="text-[10px] font-bold text-ink/45">
                        红色的地方再瞄一眼，印象更深
                      </p>
                    </div>
                  </div>

                  <ul className="mt-3 space-y-2">
                    {checkDetails
                      .filter((detail) => !detail.correct)
                      .map((detail) => (
                        <li
                          key={detail.order}
                          className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-ink/10 bg-[#FFFDF7] px-3 py-2 text-xs font-bold"
                        >
                          <span className="ink-pill border-ink/20 bg-white py-0.5 text-[10px]">
                            第 {detail.order + 1} 空
                          </span>
                          <span className="text-red-500 line-through decoration-2">
                            {detail.typed || '（空着）'}
                          </span>
                          <ArrowRight size={12} strokeWidth={3} className="text-ink/30" />
                          <span className="text-green-700">{detail.expected}</span>
                          <div className="ml-auto flex items-center gap-0.5">
                            {detail.marks.map((mark, markIndex) => (
                              <span
                                key={`${detail.order}-${markIndex}`}
                                className={`grid h-5 min-w-5 place-items-center rounded border px-0.5 text-[10px] font-black ${
                                  mark.ok
                                    ? 'border-green-300 bg-green-50 text-green-700'
                                    : 'border-red-300 bg-red-50 text-red-600'
                                }`}
                              >
                                {mark.ch}
                              </span>
                            ))}
                          </div>
                        </li>
                      ))}
                  </ul>
                </motion.section>
              )}
            </AnimatePresence>

            {/* 快捷键说明 */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold text-ink/40">
              <KeyCap>空格</KeyCap> 跳下一空
              <span className="text-ink/20">·</span>
              <KeyCap>Tab</KeyCap> 切换
              <span className="text-ink/20">·</span>
              <KeyCap>Enter</KeyCap> 检查 / 下一题
              <span className="text-ink/20">·</span>
              <KeyCap>⌘H</KeyCap> 首字母
              <span className="text-ink/20">·</span>
              <KeyCap>Esc</KeyCap> 重做
            </div>
          </>
        )}
      </main>

      {/* 轻提示 */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.95 }}
            className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 px-4"
          >
            <div
              className={`flex items-center gap-2 rounded-2xl border-[3px] border-ink px-5 py-3 text-sm font-extrabold shadow-[5px_5px_0_0_#2B2B45] ${
                toast.type === 'ok' ? 'bg-cartoon-mint' : 'bg-[#FFE3E3]'
              }`}
            >
              <span className="text-lg">{toast.type === 'ok' ? '🌟' : '💡'}</span>
              {toast.msg}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ============================================================
   展示用小组件
   ============================================================ */

type RenderChunk = {
  space: string;
  wordText?: string;
  blankOrder?: number;
  punct: string;
};

function buildChunks(exercise: Exercise): RenderChunk[] {
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

type BlankSlotProps = {
  answer: string;
  typed: string;
  order: number;
  phase: Phase;
  active: boolean;
  hint: boolean;
  detail?: CheckDetail;
  punctuation: string;
  registerInput: (order: number, el: HTMLInputElement | null) => void;
  onFocus: (order: number) => void;
  onChange: (order: number, value: string) => void;
  onKeyDown: (order: number, event: React.KeyboardEvent<HTMLInputElement>) => void;
};

function BlankSlot({
  answer,
  typed,
  order,
  phase,
  active,
  hint,
  detail,
  punctuation,
  registerInput,
  onFocus,
  onChange,
  onKeyDown,
}: BlankSlotProps) {
  const isChecked = phase === 'checked';
  const isRevealed = phase === 'revealed';
  const isStatic = isChecked || isRevealed;
  const isCorrect = isChecked && !!detail?.correct;
  const isWrong = isChecked && !!detail && !detail.correct;
  const width = Math.max(answer.length, typed.length, 2) + 0.8;

  let lineColor = '#8ED3F4';
  let highlight = 'bg-[#FFF6D6]';
  if (isRevealed || isCorrect) {
    lineColor = '#22C55E';
    highlight = 'bg-[#DCFCE7]';
  } else if (isWrong) {
    lineColor = '#EF4444';
    highlight = 'bg-[#FFE4E6]';
  } else if (active) {
    lineColor = '#FF9F1C';
    highlight = 'bg-lemon';
  } else if (typed.trim()) {
    lineColor = '#8B7CF6';
    highlight = 'bg-[#EDE9FE]';
  }

  const marks =
    isChecked && detail
      ? detail.marks
      : answer.split('').map((ch) => ({ ch, ok: isRevealed }));

  return (
    <span className="relative inline-flex items-center">
      <span
        className={`relative inline-flex h-[1.5em] items-center justify-center rounded-lg transition-all duration-150 ${
          active && !isStatic ? '-translate-y-0.5' : ''
        }`}
        style={{ width: `${width}ch` }}
      >
        <span
          className={`absolute inset-x-0.5 bottom-[0.13em] h-[0.62em] -rotate-1 rounded-[3px] ${highlight}`}
          aria-hidden
        />
        {!isStatic ? (
          <input
            ref={(el) => registerInput(order, el)}
            value={typed}
            onChange={(event) => onChange(order, event.target.value)}
            onFocus={() => onFocus(order)}
            onKeyDown={(event) => onKeyDown(order, event)}
            placeholder={hint ? `${answer[0]}…` : ''}
            aria-label={`第 ${order + 1} 个空，答案 ${answer.length} 个字母`}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            className="relative z-10 h-full w-full bg-transparent px-1 text-center font-cartoon font-extrabold leading-none text-ink caret-[#FF8A00] outline-none placeholder:text-ink/25"
          />
        ) : (
          <span
            className="relative z-10 flex h-full items-center justify-center px-1 font-extrabold leading-none"
            title={
              isWrong && detail?.typed
                ? `你写的是：${detail.typed}`
                : undefined
            }
          >
            {marks.map((mark, index) => (
              <span
                key={`${order}-mark-${index}`}
                className={
                  isCorrect || isRevealed
                    ? 'text-green-700'
                    : mark.ok
                      ? 'text-green-700'
                      : 'text-red-500'
                }
              >
                {mark.ch}
              </span>
            ))}
            {isWrong && detail && detail.extra.length > 0 ? (
              <span className="ml-0.5 text-[0.55em] text-red-400 line-through">
                {detail.extra.join('')}
              </span>
            ) : null}
          </span>
        )}

        <svg
          viewBox="0 0 100 12"
          preserveAspectRatio="none"
          className={`pointer-events-none absolute -bottom-1 left-0 h-2.5 w-full ${
            active && !isStatic ? 'animate-dash' : ''
          }`}
          aria-hidden
        >
          <path
            d="M2 7 C 18 2, 34 11, 52 6 S 82 3, 98 7"
            fill="none"
            stroke={lineColor}
            strokeWidth="4"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
            strokeDasharray={active && !isStatic ? '7 5' : undefined}
          />
        </svg>
      </span>

      {punctuation && (
        <span className="whitespace-nowrap text-ink/40">{punctuation}</span>
      )}

      {isStatic && (
        <span
          className={`absolute -right-2 -top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-ink text-[10px] font-black text-white shadow-[1px_1px_0_0_#2B2B45] ${
            isCorrect || isRevealed ? 'bg-green-400' : 'bg-red-400'
          }`}
          aria-hidden
        >
          {isCorrect || isRevealed ? '✓' : '✕'}
        </span>
      )}

      {active && !isStatic && (
        <motion.span
          aria-hidden
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          className="absolute -right-3 -top-4 text-sm"
        >
          ✨
        </motion.span>
      )}
    </span>
  );
}

function Confetti({ run, active = true }: { run: number; active?: boolean }) {
  if (!active || run === 0) return null;

  const pieces = Array.from({ length: 20 }, (_, index) => ({
    left: (index * 37 + 11) % 100,
    delay: (index % 7) * 0.045,
    rotate: (index % 2 === 0 ? 1 : -1) * (120 + index * 23),
    color: ['#FF8A80', '#FFD166', '#8ED3F4', '#B9A7FF', '#7DD3A0'][index % 5],
    size: 6 + (index % 3) * 3,
  }));

  return (
    <div key={run} className="pointer-events-none absolute inset-0 z-30 overflow-hidden">
      {pieces.map((piece, index) => (
        <motion.span
          key={index}
          initial={{ y: '120%', opacity: 1, rotate: 0 }}
          animate={{ y: '-30%', opacity: 0, rotate: piece.rotate }}
          transition={{
            duration: 1.5 + (index % 5) * 0.16,
            delay: piece.delay,
            ease: 'easeOut',
          }}
          className="absolute rounded-[2px]"
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.size,
            backgroundColor: piece.color,
          }}
        />
      ))}
    </div>
  );
}

function BackgroundDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="paper-dots absolute inset-0 opacity-50" />
      <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-lemon/50 blur-3xl" />
      <div className="absolute -right-20 top-16 h-80 w-80 rounded-full bg-cloud/40 blur-3xl" />
      <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-grape/30 blur-3xl" />
      <span className="absolute left-[5%] top-44 hidden -rotate-12 animate-float-slow text-4xl opacity-60 md:block">
        📚
      </span>
      <span
        className="absolute right-[6%] top-1/3 hidden rotate-12 animate-float-slow text-4xl opacity-60 md:block"
        style={{ animationDelay: '-2s' }}
      >
        ✏️
      </span>
      <span className="absolute bottom-28 left-[9%] hidden animate-float text-3xl opacity-50 md:block">
        ⭐
      </span>
      <span
        className="absolute bottom-44 right-[10%] hidden animate-float text-3xl opacity-50 lg:block"
        style={{ animationDelay: '-1s' }}
      >
        💡
      </span>
      <StarDoodle className="absolute right-[3%] top-10 h-10 w-10 text-ink/10" />
      <StarDoodle className="absolute bottom-16 left-[2%] h-6 w-6 text-ink/10" />
    </div>
  );
}

function StarDoodle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 3l2.4 5.2 5.6.7-4.2 3.9 1.1 5.6L12 15.7 7.1 18.4l1.1-5.6L4 8.9l5.6-.7z" />
    </svg>
  );
}

function Mascot({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <ellipse cx="50" cy="88" rx="27" ry="5" fill="#2B2B45" opacity="0.12" />
      <path
        d="M50 12c21 0 34 13 34 33 0 21-14 36-34 36S16 66 16 45c0-20 13-33 34-33z"
        fill="#FFE066"
        stroke="#2B2B45"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M50 13V7"
        stroke="#2B2B45"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M50 2l1.6 3.2 3.4.5-2.5 2.4.6 3.4L50 10l-3.1 1.5.6-3.4-2.5-2.4 3.4-.5z"
        fill="#FF8A80"
        stroke="#2B2B45"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <ellipse cx="35" cy="34" rx="9" ry="6" fill="#FFF9C9" opacity="0.85" />
      <circle cx="37" cy="49" r="7.5" fill="#FFFFFF" stroke="#2B2B45" strokeWidth="3" />
      <circle cx="63" cy="49" r="7.5" fill="#FFFFFF" stroke="#2B2B45" strokeWidth="3" />
      <circle cx="39" cy="50" r="3.2" fill="#2B2B45" />
      <circle cx="65" cy="50" r="3.2" fill="#2B2B45" />
      <circle cx="40.5" cy="48.5" r="1.1" fill="#FFFFFF" />
      <circle cx="66.5" cy="48.5" r="1.1" fill="#FFFFFF" />
      <ellipse cx="25" cy="61" rx="5" ry="3" fill="#FF9F9F" opacity="0.8" />
      <ellipse cx="75" cy="61" rx="5" ry="3" fill="#FF9F9F" opacity="0.8" />
      <path
        d="M43 62c3.5 5.5 10.5 5.5 14 0"
        fill="none"
        stroke="#2B2B45"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
      <path
        d="M19 62c-4 5-5 10-3 14"
        fill="none"
        stroke="#2B2B45"
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M81 62c4 5 5 10 3 14"
        fill="none"
        stroke="#2B2B45"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-md border-2 border-ink/20 bg-white px-1.5 py-0.5 text-[10px] font-black text-ink/55">
      {children}
    </kbd>
  );
}

function XCircleIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9l6 6M15 9l-6 6" />
    </svg>
  );
}

/* ============================================================
   入口
   ============================================================ */

export default function PracticePage() {
  return (
    <Suspense
      fallback={
        <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream font-cartoon text-ink">
          <BackgroundDecor />
          <div className="relative z-10 flex flex-col items-center gap-5">
            <Mascot className="h-24 w-24 animate-float" />
            <div className="rounded-2xl border-[3px] border-ink bg-white px-6 py-3 text-sm font-extrabold shadow-[4px_4px_0_0_#2B2B45]">
              正在翻开练习本…
            </div>
          </div>
        </div>
      }
    >
      <SearchParamsWrapper>
        {(searchParams) => <PracticePageContent searchParams={searchParams} />}
      </SearchParamsWrapper>
    </Suspense>
  );
}

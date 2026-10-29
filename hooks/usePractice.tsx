import { CATEGORIES } from "@/lib/constants";
import { Sentence, Phase, CheckDetail, Attempt, Toast, Mode } from "@/lib/type";
import { buildExercise, checkBlanks, buildTypedSentence } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState, useRef, useMemo, useEffect, useCallback } from "react";

export function usePractice({ searchParams }: { searchParams: URLSearchParams }){
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

  return {
    // 题目与阶段
    loading,
    sentences,
    currentIndex,
    phase,
    mode,
    current,
    exercise,
    detailByOrder,

    // 输入 / 批改状态
    typedWords,
    checkDetails,
    activeBlank,
    filledCount,
    totalBlanks,
    allCorrect,
    mistakes,

    // 提示开关
    showZh,
    hintLetters,
    reviewMode,

    // 战绩
    attempts,
    correctAttempts,
    accuracy,
    wrongWords,

    // 派生样式
    progress,
    categoryMeta,
    levelColor,
    tip,
    backHref,
    celebrate,

    // setters
    setShowZh,
    setHintLetters,
    setReviewMode,
    setActiveBlank,
    setToast,

    // 输入 / 焦点
    registerInput,
    focusBlank,
    handleInputChange,
    handleBlankKeyDown,

    // 操作
    resetQuestion,
    handleCheck,
    handleNext,
    handleReveal,
    startRound,
    finishEarly,

    // 轻提示
    toast,

    // 路由
    router,
  };
}
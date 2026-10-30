import { CATEGORIES } from "@/lib/constants";
import { Sentence, Phase, CheckDetail, Attempt, Toast, Mode } from "@/lib/type";
import {
  buildExercise,
  checkBlanks,
  buildTypedSentence,
  checkDictation,
  countDictationWords,
} from "@/lib/utils";
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
  const [typedSentence, setTypedSentence] = useState('');
  const [dictationExtras, setDictationExtras] = useState<string[]>([]);
  const [checkDetails, setCheckDetails] = useState<CheckDetail[]>([]);
  const [history, setHistory] = useState<Attempt[]>([]);
  const [showZh, setShowZh] = useState(false);
  const [hintLetters, setHintLetters] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [activeBlank, setActiveBlank] = useState(0);
  const [celebrate, setCelebrate] = useState(0);
  const [checking, setChecking] = useState(false);

  const inputRefs = useRef<Map<number, HTMLInputElement>>(new Map());
  const dictationRef = useRef<HTMLTextAreaElement | null>(null);
  const startedAtRef = useRef<number>(Date.now());

  const isDictation = mode === 'dictation';
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
          setTypedSentence('');
          setDictationExtras([]);
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
    setTypedSentence('');
    setDictationExtras([]);
    setCheckDetails([]);
    setPhase('typing');
    setActiveBlank(0);
    // 整句默写默认展示中文提示，填空模式默认隐藏中文
    setShowZh(mode === 'dictation');
    startedAtRef.current = Date.now();
  }, [exercise, mode]);

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

  const registerDictationInput = useCallback((el: HTMLTextAreaElement | null) => {
    dictationRef.current = el;
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

  const focusDictation = useCallback(() => {
    const el = dictationRef.current;
    if (!el) return;
    el.focus();
    window.requestAnimationFrame(() => {
      const len = el.value.length;
      try {
        el.setSelectionRange(len, len);
      } catch {
        /* 忽略浏览器差异 */
      }
    });
  }, []);

  const focusFirstInput = useCallback(() => {
    if (isDictation) focusDictation();
    else focusBlank(0);
  }, [isDictation, focusBlank, focusDictation]);

  // 新题出现后自动聚焦：填空落到第一个空，默写落到整句输入框
  useEffect(() => {
    if (phase !== 'typing' || !exercise) return;
    const timer = window.setTimeout(() => {
      const active = document.activeElement;
      if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) {
        return;
      }
      focusFirstInput();
    }, 90);
    return () => window.clearTimeout(timer);
  }, [exercise, phase, focusFirstInput]);

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

  const handleDictationChange = useCallback(
    (value: string) => {
      if (phase !== 'typing') return;
      setTypedSentence(value.replace(/\r/g, ''));
    },
    [phase],
  );

  const resetQuestion = useCallback(() => {
    if (!exercise) return;
    setTypedWords(Array(exercise.blanks.length).fill(''));
    setTypedSentence('');
    setDictationExtras([]);
    setCheckDetails([]);
    setPhase('typing');
    setActiveBlank(0);
    startedAtRef.current = Date.now();
    window.setTimeout(() => {
      if (isDictation) focusDictation();
      else focusBlank(0);
    }, 60);
  }, [exercise, isDictation, focusBlank, focusDictation]);

  /**
   * 近义替换复核：把「不精确匹配」的空交给本地 NLI 判定（app/api/judge）。
   * 判定通过的标记为「可接受替换」，让 bike / bicycle 这类答案也算对。
   */
  const refineWithSemantics = useCallback(
    async (details: CheckDetail[], sentence: Sentence): Promise<CheckDetail[]> => {
      // 跳过：已判对、没写、像拼错的、词形错的（这些都该算错，不必问模型）
      const candidates = details.filter(
        (detail) =>
          !detail.correct &&
          !detail.typo &&
          !detail.formError &&
          !detail.missing &&
          detail.typed.trim().length > 0,
      );
      if (candidates.length === 0 || !sentence.text) return details;

      try {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), 20000);
        const response = await fetch('/api/judge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sentenceId: sentence.id,
            sentence: sentence.text,
            items: candidates.map((detail) => ({
              order: detail.order,
              expected: detail.expected,
              typed: detail.typed,
            })),
          }),
          signal: controller.signal,
        });
        window.clearTimeout(timer);

        const data = (await response.json()) as {
          ok?: boolean;
          results?: Array<{ order: number; accept: boolean }>;
        };
        if (!data.ok || !Array.isArray(data.results)) return details;

        const accepted = new Set(
          data.results.filter((result) => result.accept).map((result) => result.order),
        );
        if (accepted.size === 0) return details;

        let found = 0;
        const next = details.map((detail) => {
          if (!accepted.has(detail.order) || detail.correct) return detail;
          found += 1;
          return {
            ...detail,
            correct: true,
            alternative: true,
            missing: false,
            marks: detail.typed.split('').map((ch) => ({ ch, ok: true })),
            extra: [],
          };
        });

        if (found > 0) {
          setToast({ msg: `有 ${found} 处是近义替换，也算对哦 ✨`, type: 'ok' });
        }
        return next;
      } catch {
        // 复核失败不影响正常判分
        return details;
      }
    },
    [],
  );

  const handleCheck = useCallback(async () => {
    if (!current || !exercise || phase !== 'typing' || checking) return;

    const hasInput = isDictation
      ? typedSentence.trim().length > 0
      : typedWords.some((word) => word.trim().length > 0);

    if (!hasInput) {
      setToast({ msg: '先写点什么再检查吧～', type: 'warn' });
      if (isDictation) focusDictation();
      else focusBlank(0);
      return;
    }

    setChecking(true);
    try {
      let details: CheckDetail[];
      let extraWords: string[] = [];

      if (isDictation) {
        const result = checkDictation(current.text, typedSentence);
        details = result.details;
        extraWords = result.extraWords;
      } else {
        details = checkBlanks(exercise, typedWords);
      }

      // 本地近义复核（拼写变体已在 checkBlanks/checkDictation 内判对）
      details = await refineWithSemantics(details, current);

      const mistakes =
        details.filter((detail) => !detail.correct).length + extraWords.length;
      const overallCorrect = mistakes === 0;

      setCheckDetails(details);
      setDictationExtras(extraWords);
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
          extraWords,
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
          typedText: isDictation
            ? typedSentence.trim()
            : buildTypedSentence(exercise, typedWords),
        }),
      }).catch(() => {
        /* 记录失败不打断练习 */
      });
    } finally {
      setChecking(false);
    }
  }, [
    current,
    exercise,
    phase,
    checking,
    typedWords,
    typedSentence,
    isDictation,
    mode,
    focusBlank,
    focusDictation,
    refineWithSemantics,
  ]);

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

  const handleDictationKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (phase !== 'typing') return;
      if (event.key === 'Enter' && !event.shiftKey) {
        // ⌘/Ctrl + Enter 交给全局快捷键处理（看答案）
        if (event.metaKey || event.ctrlKey) return;
        event.preventDefault();
        handleCheck();
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        resetQuestion();
      }
    },
    [phase, handleCheck, resetQuestion],
  );

  const handleNext = useCallback(() => {
    if (currentIndex + 1 >= sentences.length) {
      setPhase('summary');
      return;
    }
    // 先清掉上一题的批改结果，避免切换瞬间闪出旧的对错标记
    setTypedWords([]);
    setTypedSentence('');
    setDictationExtras([]);
    setCheckDetails([]);
    setShowZh(mode === 'dictation');
    setPhase('typing');
    startedAtRef.current = Date.now();
    setCurrentIndex((index) => index + 1);
  }, [currentIndex, sentences.length, mode]);

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
    setTypedSentence('');
    setDictationExtras([]);
    setPhase('typing');
    setActiveBlank(0);
    setShowZh(mode === 'dictation');
    setCelebrate(0);
    startedAtRef.current = Date.now();

    if (currentIndex !== 0) {
      setCurrentIndex(0);
    } else {
      window.setTimeout(() => {
        if (isDictation) focusDictation();
        else focusBlank(0);
      }, 80);
    }
  }, [exercise, currentIndex, mode, isDictation, focusBlank, focusDictation]);

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
        if (phase === 'typing' && !isEditable) {
          window.setTimeout(focusFirstInput, 0);
        }
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

      if (event.key === 'Escape' && phase === 'typing' && !isEditable) {
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
        // 整句默写：把按键写进整句文本框
        if (isDictation) {
          event.preventDefault();
          setTypedSentence((prev) => prev + event.key);
          focusDictation();
          return;
        }

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
    isDictation,
    focusBlank,
    focusDictation,
    focusFirstInput,
    handleNext,
    handleReveal,
    resetQuestion,
  ]);

  /* ---------------- 派生状态 ---------------- */

  const totalBlanks = exercise?.blanks.length ?? 0;
  const totalUnits = isDictation
    ? countDictationWords(current?.text ?? '')
    : totalBlanks;
  const filledCount = isDictation
    ? countDictationWords(typedSentence)
    : typedWords.filter((word) => word.trim()).length;
  const correctUnits = checkDetails.filter((detail) => detail.correct).length;
  const attempts = history.length;
  const correctAttempts = history.filter((attempt) => attempt.correct).length;
  const accuracy = attempts > 0 ? Math.round((correctAttempts / attempts) * 100) : 0;
  const allCorrect =
    phase === 'checked' &&
    checkDetails.length > 0 &&
    checkDetails.every((detail) => detail.correct) &&
    dictationExtras.length === 0;
  const mistakes =
    checkDetails.filter((detail) => !detail.correct).length +
    (isDictation ? dictationExtras.length : 0);
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
      if (allCorrect) {
        return isDictation
          ? '整句全对！你的记忆力和拼写都闪闪发光 ✨'
          : '全对！你的拼写闪闪发光，继续保持 ✨';
      }
      return isDictation
        ? `就差一点点，${mistakes} 处看看下面的逐词对照～`
        : `就差一点点，${mistakes} 个空看看下面的小报告～`;
    }
    if (phase === 'revealed') return '答案已经亮出来啦，记一记，下一题一定行！';

    if (isDictation) {
      if (hintLetters) return '首字母已经露出来啦，顺着把整句写完吧～';
      if (filledCount === 0) return '先读懂中文，再把整句英文写进下面的默写纸吧！';
      if (filledCount < totalUnits) {
        return `已经写了 ${filledCount} / ${totalUnits} 个词，继续把整句补完整～`;
      }
      return '整句写完啦，按 Enter 检查一下？';
    }

    if (hintLetters) return '首字母偷偷露出头啦，顺着往下写～';
    if (filledCount === 0) return '点一下彩色下划线，把缺的单词写进去吧！';
    if (filledCount < totalUnits) return `已经填好 ${filledCount} / ${totalUnits} 个空啦，继续加油！`;
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
    isDictation,
    current,
    exercise,
    detailByOrder,

    // 输入 / 批改状态
    typedWords,
    typedSentence,
    dictationExtras,
    checkDetails,
    activeBlank,
    filledCount,
    totalBlanks,
    totalUnits,
    correctUnits,
    allCorrect,
    mistakes,
    checking,

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
    registerDictationInput,
    focusBlank,
    focusDictation,
    handleInputChange,
    handleDictationChange,
    handleBlankKeyDown,
    handleDictationKeyDown,

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
import { BlankSlot } from "@/components/blankSlot";
import { BackgroundDecor, Mascot, Confetti, KeyCap } from "@/components/cartoon";
import { DictationBoard } from "@/components/dictationBoard";
import { usePractice } from "@/hooks/usePractice";
import { buildChunks } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Star, Home, RotateCcw, Flag, Languages, Lightbulb, CheckCircle2, XCircleIcon, Eye } from "lucide-react";
import Link from "next/link";

export function PracticePageContent({ searchParams }: { searchParams: URLSearchParams }) {
  const {
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
  } = usePractice({ searchParams });

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

  const refocusTypingInput = () => {
    if (phase !== 'typing') return;
    window.setTimeout(() => {
      if (isDictation) focusDictation();
      else focusBlank(activeBlank);
    }, 0);
  };

  const alternativeDetails = checkDetails.filter(
    (detail) => detail.correct && detail.alternative,
  );

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
                    ? isDictation
                      ? `${totalUnits} 个词 · 看中文写英文`
                      : `${totalUnits} 个空 · 点下划线输入`
                    : phase === 'checked'
                      ? isDictation
                        ? `${correctUnits} / ${totalUnits} 个词写对${
                            dictationExtras.length > 0
                              ? ` · 多写 ${dictationExtras.length}`
                              : ''
                          }`
                        : `${correctUnits} / ${totalUnits} 个空写对`
                      : '答案已亮出'}
                </span>
              </div>

              <div className="relative overflow-hidden bg-[#FFFDF7] px-3 py-9 md:px-10 md:py-12">
                <div className="paper-dots absolute inset-0 opacity-40" />

                {isDictation ? (
                  <DictationBoard
                    text={current?.text ?? ''}
                    zh={current?.zh}
                    phase={phase}
                    typed={typedSentence}
                    showZh={showZh}
                    hint={hintLetters}
                    allCorrect={allCorrect}
                    detailByOrder={detailByOrder}
                    extraWords={dictationExtras}
                    registerInput={registerDictationInput}
                    onChange={handleDictationChange}
                    onKeyDown={handleDictationKeyDown}
                  />
                ) : (
                  <>
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
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t-[3px] border-dashed border-ink/15 bg-white px-4 py-2.5 md:px-6">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setHintLetters((value) => !value);
                      refocusTypingInput();
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
                      refocusTypingInput();
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
                  {isDictation
                    ? 'Enter 检查 · Shift + Enter 换行 · 标点不计错'
                    : 'Tab / 空格 跳下一空 · Enter 检查'}
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
                        ? alternativeDetails.length > 0
                          ? `全对！其中 ${alternativeDetails.length} 处是近义替换（也算对）`
                          : isDictation
                            ? '整句全对！这一句写得漂亮'
                            : '全对！这一题漂亮拿下'
                        : isDictation
                          ? `还有 ${mistakes} 处需要订正`
                          : `还差一点点，有 ${mistakes} 个空需要订正`}
                    </p>
                    <p className="text-[11px] font-bold text-ink/55 md:text-xs">
                      {allCorrect
                        ? '按 Enter 直接进入下一题'
                        : isDictation
                          ? '看看下面的逐词对照，再试一次也可以'
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
                    <p className="text-sm font-extrabold">
                      {isDictation ? '整句答案已经亮出来啦' : '答案已经全部填好啦'}
                    </p>
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
                    disabled={filledCount === 0 || checking}
                    className="ink-btn ink-btn-primary flex-1 py-4 text-base disabled:opacity-60"
                  >
                    <CheckCircle2 size={20} strokeWidth={3} />
                    {checking
                      ? '正在批改…'
                      : isDictation
                        ? '检查整句'
                        : '检查答案'}
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

            {/* 批改 / 逐词对照 */}
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
                      <h3 className="text-sm font-extrabold">
                        {isDictation ? '逐词对照' : '批改小报告'}
                      </h3>
                      <p className="text-[10px] font-bold text-ink/45">
                        {isDictation
                          ? '红色的词再记一遍，整句就稳了'
                          : '红色的地方再瞄一眼，印象更深'}
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
                            {isDictation
                              ? `第 ${detail.order + 1} 个词`
                              : `第 ${detail.order + 1} 空`}
                          </span>
                          {detail.typo && (
                            <span className="ink-pill border-amber-300 bg-amber-50 py-0.5 text-[10px] text-amber-700">
                              拼写错误
                            </span>
                          )}
                          {detail.formError && (
                            <span className="ink-pill border-violet-300 bg-violet-50 py-0.5 text-[10px] text-violet-700">
                              词形错误
                            </span>
                          )}
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

                    {isDictation && dictationExtras.length > 0 && (
                      <li className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-red-100 bg-[#FFF5F5] px-3 py-2 text-xs font-bold">
                        <span className="ink-pill border-red-200 bg-white py-0.5 text-[10px] text-red-500">
                          多写
                        </span>
                        <span className="text-red-500 line-through decoration-2">
                          {dictationExtras.join(' / ')}
                        </span>
                        <span className="text-[10px] font-bold text-ink/40">
                          整句里不需要这些词，删掉就好
                        </span>
                      </li>
                    )}
                  </ul>
                </motion.section>
              )}
            </AnimatePresence>

            {/* 近义替换：也算对，单独说明 */}
            <AnimatePresence initial={false}>
              {phase === 'checked' && alternativeDetails.length > 0 && (
                <motion.section
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="ink-card mt-5 p-5"
                >
                  <div className="flex items-center gap-2">
                    <span className="grid h-8 w-8 place-items-center rounded-xl border-2 border-ink bg-[#E0F2FE] text-sm shadow-[2px_2px_0_0_#2B2B45]">
                      🔁
                    </span>
                    <div>
                      <h3 className="text-sm font-extrabold">近义替换（也算对）</h3>
                      <p className="text-[10px] font-bold text-ink/45">
                        意思一样就是好答案，标准答案也一并记一下～
                      </p>
                    </div>
                  </div>

                  <ul className="mt-3 space-y-2">
                    {alternativeDetails.map((detail) => (
                      <li
                        key={detail.order}
                        className="flex flex-wrap items-center gap-2 rounded-xl border-2 border-sky-100 bg-[#F0F9FF] px-3 py-2 text-xs font-bold"
                      >
                        <span className="ink-pill border-sky-200 bg-white py-0.5 text-[10px] text-sky-600">
                          {isDictation
                            ? `第 ${detail.order + 1} 个词`
                            : `第 ${detail.order + 1} 空`}
                        </span>
                        <span className="text-sky-700">{detail.typed}</span>
                        {detail.typed.toLowerCase() !== detail.expected.toLowerCase() && (
                          <>
                            <span className="text-[10px] font-bold text-ink/35">标准答案</span>
                            <span className="text-green-700">{detail.expected}</span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>
                </motion.section>
              )}
            </AnimatePresence>

            {/* 快捷键说明 */}
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold text-ink/40">
              {isDictation ? (
                <>
                  <KeyCap>Enter</KeyCap> 检查 / 下一题
                  <span className="text-ink/20">·</span>
                  <KeyCap>Shift + Enter</KeyCap> 换行
                  <span className="text-ink/20">·</span>
                  <KeyCap>⌘H</KeyCap> 首字母
                  <span className="text-ink/20">·</span>
                  <KeyCap>Esc</KeyCap> 重做
                </>
              ) : (
                <>
                  <KeyCap>空格</KeyCap> 跳下一空
                  <span className="text-ink/20">·</span>
                  <KeyCap>Tab</KeyCap> 切换
                  <span className="text-ink/20">·</span>
                  <KeyCap>Enter</KeyCap> 检查 / 下一题
                  <span className="text-ink/20">·</span>
                  <KeyCap>⌘H</KeyCap> 首字母
                  <span className="text-ink/20">·</span>
                  <KeyCap>Esc</KeyCap> 重做
                </>
              )}
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
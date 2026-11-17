'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle2,
  Flag,
  Home,
  RotateCcw,
  RefreshCw,
  Volume2,
  VolumeX,
  Headphones,
  Eye,
  Sparkles,
} from 'lucide-react';
import { BackgroundDecor } from '@/components/interactiveBackground';
import { KeyCap, Mascot, WinStamp, CountUp, Squiggle, StarFlight } from '@/components/cartoon';
import { WordAudio } from '@/components/wordAudio';
import { useWordPractice } from '@/hooks/useWordPractice';
import { isSoundEnabled, playCorrectChime, setSoundEnabled } from '@/lib/sfx';

export function WordPracticeContent({ searchParams }: { searchParams: URLSearchParams }) {
  const wp = useWordPractice({ searchParams });
  const {
    loading,
    loadError,
    level,
    words,
    currentIndex,
    phase,
    typed,
    setTyped,
    current,
    lastDetail,
    celebrate,
    autoSpeak,
    setAutoSpeak,
    totalUnits,
    answered,
    correctUnits,
    accuracy,
    progress,
    inputRef,
    handleCheck,
    goNext,
    handleReveal,
    resetQuestion,
    retryWrong,
    finishEarly,
    wrongQueue,
    history,
    attemptsByWord,
    restartRound,
    backHref,
  } = wp;

  /* ---------------- 庆祝音效 & 星星 ---------------- */
  const cardRef = useRef<HTMLElement | null>(null);
  const starCounterRef = useRef<HTMLDivElement | null>(null);
  const [starRun, setStarRun] = useState(0);
  const [starLandKey, setStarLandKey] = useState(0);
  const [soundOn, setSoundOn] = useState(true);

  useEffect(() => {
    setSoundOn(isSoundEnabled());
  }, []);

  const prevCelebrate = useRef(0);
  useEffect(() => {
    if (celebrate > prevCelebrate.current) {
      setStarRun(celebrate);
      if (isSoundEnabled()) playCorrectChime();
    }
    prevCelebrate.current = celebrate;
  }, [celebrate]);

  const toggleSound = () => {
    setSoundOn((on) => {
      setSoundEnabled(!on);
      return !on;
    });
  };

  /* ---------------- 加载 / 出错 ---------------- */

  if (loading || loadError) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream font-cartoon text-ink">
        <BackgroundDecor />
        <div className="relative z-10 flex flex-col items-center gap-5">
          <Mascot className="h-24 w-24 animate-float" />
          <div className="rounded-2xl border-[3px] border-ink bg-white px-6 py-3 text-sm font-extrabold shadow-[4px_4px_0_0_#2B2B45]">
            {loadError || '正在挑单词…'}
          </div>
          <Link href="/" className="ink-btn ink-btn-white text-xs">
            回首页
          </Link>
        </div>
      </div>
    );
  }

  /* ---------------- 小结 ---------------- */

  if (phase === 'summary') {
    const wrongList = history.filter((h) => !h.correct && !h.lenient);
    const lenientList = history.filter((h) => !h.correct && h.lenient);
    return (
      <div className="relative min-h-screen overflow-hidden bg-cream px-4 py-6 font-cartoon text-ink md:px-8 md:py-10">
        <BackgroundDecor />
        <div className="relative z-10 mx-auto w-full max-w-3xl">
          <section className="ink-card relative overflow-hidden p-6 text-center md:p-10">
            <Mascot className="mx-auto h-28 w-28 animate-float" />
            <h2 className="mt-2 text-3xl font-extrabold md:text-4xl">本轮默写完成 🎉</h2>
            <p className="mt-1 text-sm font-bold text-ink/50">
              {level === 'all' ? '混合等级' : `${level} 词汇`} · 共 {answered} 个单词
            </p>

            <div className="mt-6 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border-[3px] border-ink bg-[#EEF6FF] px-3 py-4 shadow-[4px_4px_0_0_#2B2B45]">
                <div className="text-2xl font-black md:text-3xl">
                  <CountUp to={answered} />
                </div>
                <div className="mt-1 text-[11px] font-black text-ink/50">默写单词</div>
              </div>
              <div className="rounded-2xl border-[3px] border-ink bg-cartoon-mint/60 px-3 py-4 shadow-[4px_4px_0_0_#2B2B45]">
                <div className="text-2xl font-black md:text-3xl">
                  <CountUp to={correctUnits} />
                </div>
                <div className="mt-1 text-[11px] font-black text-ink/50">写对</div>
              </div>
              <div className="rounded-2xl border-[3px] border-ink bg-lemon/80 px-3 py-4 shadow-[4px_4px_0_0_#2B2B45]">
                <div className="text-2xl font-black md:text-3xl">
                  <CountUp to={accuracy} suffix="%" />
                </div>
                <div className="mt-1 text-[11px] font-black text-ink/50">正确率</div>
              </div>
            </div>

            {wrongList.length > 0 && (
              <div className="mt-6 rounded-2xl border-2 border-dashed border-red-200 bg-[#FFF5F5] p-4 text-left">
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-red-400">
                  <Sparkles size={13} strokeWidth={3} /> 下次记住它们
                </p>
                <div className="flex flex-wrap gap-2">
                  {wrongList.map((w, i) => (
                    <span
                      key={`${w.word}-${i}`}
                      className="rounded-xl border-2 border-red-200 bg-white px-2.5 py-1 text-xs font-bold"
                    >
                      <span className="text-red-500 line-through decoration-2">{w.typed || '空着'}</span>
                      <ArrowRight size={10} strokeWidth={3} className="mx-1 inline text-ink/50" />
                      <span className="text-green-700">{w.word}</span>
                      <span className="ml-1 text-ink/55">{w.translation}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {lenientList.length > 0 && (
              <div className="mt-4 rounded-2xl border-2 border-dashed border-lemon bg-lemon/10 p-4 text-left">
                <p className="mb-2 text-[11px] font-black uppercase tracking-widest text-ink/55">
                  只差一点点（拼写变体/手误）
                </p>
                <div className="flex flex-wrap gap-2">
                  {lenientList.map((w, i) => (
                    <span
                      key={`${w.word}-${i}`}
                      className="rounded-xl border-2 border-lemon bg-white px-2.5 py-1 text-xs font-bold"
                    >
                      {w.typed} <ArrowRight size={10} strokeWidth={3} className="mx-1 inline text-ink/50" />
                      {w.word}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="mx-auto mt-7 flex max-w-2xl flex-col gap-3 sm:flex-row">
              {wrongQueue.length > 0 && (
                <button
                  type="button"
                  onClick={retryWrong}
                  className="ink-btn ink-btn-primary flex-1 py-3.5 text-base"
                >
                  <RotateCcw size={18} strokeWidth={3} /> 重练这 {wrongQueue.length} 个错词
                </button>
              )}
              <button
                type="button"
                onClick={restartRound}
                className="ink-btn ink-btn-white flex-1 py-3.5 text-base"
              >
                <RefreshCw size={18} strokeWidth={3} /> 再来一组
              </button>
              <Link href="/" className="ink-btn ink-btn-white flex-1 py-3.5 text-base">
                <Home size={18} strokeWidth={3} /> 回首页
              </Link>
            </div>
          </section>
        </div>
      </div>
    );
  }

  /* ---------------- 默写主界面 ---------------- */

  const detail = current ? wp.details.get(current.word) : undefined;
  const isStatic = phase === 'checked' || phase === 'revealed';
  const passed = !!detail && (detail.correct || detail.lenient);
  const attemptCount = current ? attemptsByWord.get(current.word) ?? 0 : 0;
  // 第一次答错只给字母提示；第二次答错或主动看答案才展示完整拼写
  const showFullAnswer =
    isStatic &&
    !detail?.correct &&
    (phase === 'revealed' || attemptCount >= 2 || Boolean(detail?.lenient));
  const showAnswer = showFullAnswer;

  // 逐字母对照：答案 vs 你写的
  const answer = current?.word ?? '';
  const typedNorm = typed.toLowerCase();

  return (
    <div className="relative min-h-screen overflow-hidden bg-cream px-4 py-6 font-cartoon text-ink md:px-8 md:py-10">
      <BackgroundDecor />

      <div className="relative z-10 mx-auto w-full max-w-3xl">
        {/* 顶栏 */}
        <div className="mb-4 flex items-center gap-3">
          <Link
            href={backHref}
            className="ink-btn ink-btn-white inline-flex shrink-0 px-2.5 py-1.5 text-[11px]"
          >
            <Home size={13} strokeWidth={3} />
            <span className="hidden sm:inline">首页</span>
          </Link>

          <div className="flex shrink-0 items-center gap-2 rounded-full border-[3px] border-ink bg-white px-3 py-1.5 text-xs font-extrabold shadow-[3px_3px_0_0_#2B2B45]">
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ink px-1 text-[10px] text-white">
              {answered + (phase === 'typing' ? 1 : 0)}
            </span>
            <span className="hidden sm:inline">/ {totalUnits} 词</span>
            <span className="sm:hidden">/{totalUnits}</span>
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

          <motion.div
            ref={starCounterRef}
            key={`wstar-${starLandKey}`}
            initial={starLandKey === 0 ? false : { scale: 1.6, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 500, damping: 15 }}
            className="hidden shrink-0 items-center gap-1 rounded-full border-[3px] border-ink bg-white px-3 py-1.5 text-xs font-extrabold shadow-[3px_3px_0_0_#2B2B45] sm:flex"
          >
            ⭐ {correctUnits}
          </motion.div>

          <button
            type="button"
            onClick={toggleSound}
            className="ink-btn ink-btn-white inline-flex px-2.5 py-1.5 text-[11px]"
            title={soundOn ? '关闭音效' : '打开音效'}
          >
            {soundOn ? <Volume2 size={13} strokeWidth={3} /> : <VolumeX size={13} strokeWidth={3} />}
          </button>

          <button
            type="button"
            onClick={finishEarly}
            className="ink-btn ink-btn-white inline-flex px-2.5 py-1.5 text-[11px]"
            title="提前交卷看成绩"
          >
            <Flag size={13} strokeWidth={3} />
            <span className="hidden sm:inline">交卷</span>
          </button>
        </div>

        {/* 提示气泡 */}
        <div className="mb-4 flex items-end gap-2.5">
          <Mascot className="mb-1 h-16 w-16 shrink-0 animate-float md:h-20 md:w-20" />
          <div className="relative flex-1 rounded-2xl rounded-bl-md border-[3px] border-ink bg-white px-4 py-2.5 shadow-[4px_4px_0_0_#2B2B45]">
            <p className="text-sm font-extrabold leading-snug md:text-[15px]">
              {phase === 'typing' && <>看中文意思{autoSpeak ? '，听发音' : ''}，把这个单词写出来 ✍️</>}
              {phase === 'checked' &&
                (detail?.correct ? (
                  <span className="text-green-600">
                    完全正确！ <span className="text-ink/60">马上到下一个词…</span>
                  </span>
                ) : passed ? (
                  <span className="text-amber-600">
                    基本正确（拼写变体或手误），按 <b>Enter</b> 进入下一个词，或 <b>Esc</b> 重写一遍
                  </span>
                ) : (
                  <span className="text-red-500">
                    先看字母提示，按 <b>Enter</b> 重写一遍；想不起来就点“看答案” 💪
                  </span>
                ))}
              {phase === 'revealed' && <>这是正确答案，记住拼法后按 Enter 继续。</>}
            </p>
            <span className="absolute -left-1 bottom-2 h-3 w-3 rotate-45 border-b-[3px] border-l-[3px] border-ink bg-white" />
          </div>
        </div>

        {/* 单词主卡 */}
        <section ref={cardRef} className="ink-card relative overflow-hidden">
          <WinStamp run={celebrate} />

          <div className="flex flex-wrap items-center justify-between gap-2 border-b-[3px] border-ink bg-lemon px-4 py-2.5 md:px-6">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="ink-pill bg-white text-[10px] uppercase tracking-widest">
                📝 Word Quiz
              </span>
              {current && (
                <span className="ink-pill border-ink/20 bg-white/85 text-[10px]">{current.level}</span>
              )}
            </div>
            <label className="flex cursor-pointer select-none items-center gap-1.5 text-[11px] font-extrabold text-ink/60">
              <input
                type="checkbox"
                checked={autoSpeak}
                onChange={(e) => setAutoSpeak(e.target.checked)}
                className="h-3.5 w-3.5 accent-[#FFB26B]"
              />
              <Headphones size={13} strokeWidth={3} /> 出题自动读音
            </label>
          </div>

          <div className="relative overflow-hidden bg-[#FFFDF7] px-4 py-9 md:px-10 md:py-12">
            <div className="paper-dots absolute inset-0 opacity-40" />
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={current?.word ?? 'none'}
                initial={{ x: '58%', opacity: 0, scale: 0.97 }}
                animate={{ x: 0, opacity: 1, scale: 1 }}
                exit={{ x: '-58%', opacity: 0, scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 320, damping: 28, mass: 0.9 }}
                className="relative z-10 flex flex-col items-center"
              >
                {/* 中文意思 */}
                <h2 className="animate-word-in text-center text-2xl font-black leading-snug text-ink md:text-4xl">
                  {current?.translation}
                </h2>

                {/* 音标 + 发音 */}
                <div
                  className="animate-word-in mt-3 flex items-center gap-2"
                  style={{ animationDelay: '90ms' }}
                >
                  {current?.phonetic && (
                    <span className="font-mono text-sm font-bold text-cartoon-blue md:text-base">
                      /{current.phonetic}/
                    </span>
                  )}
                  {current && <WordAudio word={current.word} size={17} />}
                </div>

                {/* 答案书写区 */}
                <div className="mt-7 w-full max-w-xl" style={{ animationDelay: '160ms' }}>
                  {!isStatic ? (
                    <div className="animate-word-in relative">
                      <input
                        ref={inputRef}
                        value={typed}
                        onChange={(e) => setTyped(e.target.value.replace(/\s+/g, ''))}
                        spellCheck={false}
                        autoComplete="off"
                        autoCapitalize="none"
                        autoCorrect="off"
                        placeholder="在这里写出单词…"
                        className="w-full rounded-2xl border-[3px] border-ink bg-white px-5 py-3.5 text-center font-mono text-2xl font-extrabold tracking-wide text-ink shadow-[4px_4px_0_0_#2B2B45] outline-none transition-all caret-[#FF8A00] placeholder:text-base placeholder:font-bold placeholder:text-ink/25 focus:border-cartoon-orange focus:shadow-[4px_4px_0_0_#FFB26B] md:text-3xl"
                      />
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      {/* 逐字母对照 */}
                      <div className="relative inline-block">
                        <span className="flex items-center justify-center gap-[2px] font-mono text-3xl font-black md:text-4xl">
                          {answer.split('').map((ch, i) => {
                            const typedCh = typedNorm[i] ?? '';
                            const ok = typedCh.toLowerCase() === ch.toLowerCase();
                            const masked = !showFullAnswer && !detail?.correct;
                            const visibleCh = masked && i > 0 && !ok ? '·' : ch;
                            const color = detail?.correct
                              ? 'text-green-600'
                              : masked
                                ? ok
                                  ? 'text-green-600'
                                  : 'text-ink/30'
                                : ok
                                  ? 'text-green-600'
                                  : typedCh
                                    ? 'text-red-500'
                                    : 'text-ink/30';
                            return (
                              <span
                                key={i}
                                className={`${masked ? '' : 'animate-wave-pop'} inline-block`}
                                style={{ animationDelay: `${i * 45}ms` }}
                              >
                                {visibleCh}
                              </span>
                            );
                          })}
                          <span className="sr-only">{answer}</span>
                          <span className="pointer-events-none sr-only">
                            {typed ? `你写的是 ${typed}` : ''}
                          </span>
                        </span>
                        {detail?.correct && <Squiggle active delay={0.15} />}
                      </div>

                      {/* 第一次答错：只给长度和首字母，避免直接抄答案 */}
                      {isStatic && !detail?.correct && !showFullAnswer && (
                        <p className="max-w-sm text-center text-xs font-bold leading-relaxed text-ink/60">
                          答案共 <b>{answer.length}</b> 个字母，首字母是{' '}
                          <span className="rounded-md bg-lemon/50 px-1.5 py-0.5 font-mono text-ink">
                            {answer[0]}
                          </span>
                          。再试一次，或点“看答案”。
                        </p>
                      )}

                      {/* 写错时显示你的原文 */}
                      {showAnswer && (
                        <p className="text-xs font-bold text-ink/55">
                          你写的是：
                          <span className="mx-1 rounded-md bg-[#FFE3E3] px-2 py-0.5 font-mono text-red-500">
                            {typed || '（空着）'}
                          </span>
                          {detail?.lenient && (
                            <span className="ml-2 rounded-md bg-lemon/40 px-2 py-0.5 text-ink/60">
                              只差一点点
                            </span>
                          )}
                        </p>
                      )}
                      {current && (
                        <div className="mt-1">
                          <WordAudio word={current.word} size={16} />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* 底部操作栏 */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t-[3px] border-dashed border-ink/15 bg-white px-4 py-3 md:px-6">
            <div className="flex flex-wrap items-center gap-2">
              {phase === 'typing' && (
                <button
                  type="button"
                  onClick={handleReveal}
                  className="ink-pill gap-1.5 border-2 border-ink bg-white py-1.5 transition-all hover:bg-lemon/40"
                >
                  <Eye size={13} strokeWidth={3} />
                  不会，看答案
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {phase === 'typing' && (
                <button
                  type="button"
                  onClick={handleCheck}
                  disabled={typed.trim().length === 0}
                  className="ink-btn ink-btn-primary inline-flex px-5 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <CheckCircle2 size={16} strokeWidth={3} />
                  检查
                  <KeyCap>Enter</KeyCap>
                </button>
              )}
              {phase === 'checked' && !passed && (
                <>
                  <button
                    type="button"
                    onClick={resetQuestion}
                    className="ink-btn ink-btn-primary inline-flex px-5 py-2 text-sm"
                  >
                    <RotateCcw size={16} strokeWidth={3} />
                    再试一次
                    <KeyCap>Enter</KeyCap>
                  </button>
                  {!showFullAnswer && (
                    <button
                      type="button"
                      onClick={handleReveal}
                      className="ink-btn ink-btn-white inline-flex px-4 py-2 text-sm"
                    >
                      <Eye size={16} strokeWidth={3} />
                      看答案
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={goNext}
                    className="ink-btn ink-btn-white inline-flex px-4 py-2 text-sm"
                  >
                    下一个词
                    <ArrowRight size={16} strokeWidth={3} />
                  </button>
                </>
              )}
              {(phase === 'checked' && passed) || phase === 'revealed' ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="ink-btn ink-btn-primary inline-flex px-5 py-2 text-sm"
                >
                  {currentIndex + 1 < totalUnits ? '下一个词' : '看成绩'}
                  <ArrowRight size={16} strokeWidth={3} />
                  <KeyCap>Enter</KeyCap>
                </button>
              ) : null}
            </div>
          </div>
        </section>

        {/* 快捷键说明 */}
        <div className="mt-5 hidden flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[11px] font-extrabold text-ink/55 sm:flex">
          <span className="flex items-center gap-1.5">
            <KeyCap>直接敲字母</KeyCap> 落进输入框
          </span>
          <span className="flex items-center gap-1.5">
            <KeyCap>Enter</KeyCap> 检查 · 答错重写 · 下一词
          </span>
          <span className="flex items-center gap-1.5">
            <KeyCap>⌘/Ctrl</KeyCap>+<KeyCap>Enter</KeyCap> 看答案
          </span>
          <span className="flex items-center gap-1.5">
            <KeyCap>Esc</KeyCap> 重写本题
          </span>
        </div>
      </div>

      <StarFlight
        run={starRun}
        fromRef={cardRef}
        toRef={starCounterRef}
        onLanded={() => {
          setStarRun(0);
          setStarLandKey((n) => n + 1);
        }}
      />
    </div>
  );
}

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowRight, BookOpen, RotateCcw, SpellCheck, Trash2 } from 'lucide-react';
import { Mascot, StarDoodle } from '@/components/cartoon';
import { BackgroundDecor } from '@/components/interactiveBackground';
import { CATEGORIES } from '@/lib/constants';
import type { Sentence } from '@/lib/type';

type ReviewSentence = Sentence & {
  total_attempts: number;
  correct_count: number;
  accuracy: number;
};

type ReviewWord = {
  word: string;
  phonetic: string;
  translation: string;
  level: string;
  total_attempts: number;
  correct_count: number;
  wrong_count: number;
  accuracy: number;
  last_attempt_at: string;
};

type Tab = 'sentences' | 'words';

/** 等级配色 —— 和首页的 LEVEL_ACTIVE 保持一致 */
const LEVEL_COLOR: Record<string, string> = {
  A1: 'bg-cartoon-mint',
  A2: 'bg-cloud',
  B1: 'bg-grape',
  B2: 'bg-cartoon-orange',
  C1: 'bg-cartoon-coral',
  C2: 'bg-[#F9A8D4]',
};

const categoryMeta = (id: string) =>
  CATEGORIES.find((c) => c.id === id) ?? { id, label: id, icon: '📖' };

const accuracyTone = (a: number) =>
  a < 40
    ? { text: 'text-red-500', bar: 'bg-cartoon-coral', face: '😖' }
    : a < 70
      ? { text: 'text-cartoon-orange', bar: 'bg-lemon', face: '😅' }
      : { text: 'text-emerald-500', bar: 'bg-cartoon-mint', face: '🙂' };

export default function ReviewPage() {
  const [sentences, setSentences] = useState<ReviewSentence[]>([]);
  const [words, setWords] = useState<ReviewWord[]>([]);
  const [tab, setTab] = useState<Tab>('sentences');
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/stats?type=review&limit=50').then((r) => r.json()),
      fetch('/api/stats?type=review-words&limit=50').then((r) => r.json()),
    ])
      .then(([sentenceData, wordData]) => {
        if (sentenceData.ok) setSentences(sentenceData.sentences ?? []);
        if (wordData.ok) setWords(wordData.words ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('tab') === 'words') setTab('words');
    load();
  }, [load]);

  async function handleClear() {
    setClearing(true);
    try {
      const scope = tab === 'words' ? 'words' : 'sentences';
      const res = await fetch(`/api/records?scope=${scope}`, { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      if (tab === 'words') setWords([]);
      else setSentences([]);
    } catch (err) {
      console.error(err);
      alert('清空失败了，再试一次？');
    } finally {
      setClearing(false);
      setConfirming(false);
    }
  }

  /** 只带 ids + dataset：ids 已唯一确定句子，再叠 level/category 会把结果交没了 */
  const practiceHref = (s: ReviewSentence) =>
    `/practice?ids=${encodeURIComponent(s.id)}&dataset=${encodeURIComponent(s.dataset_id)}`;

  const wordHref = (w: ReviewWord) =>
    `/word?content=word&ids=${encodeURIComponent(w.word)}&level=all`;

  const reviewAllWordsHref = () =>
    `/word?content=word&level=all&ids=${encodeURIComponent(words.map((w) => w.word).join(','))}`;

  const activeItems = tab === 'sentences' ? sentences : words;
  const activeCount = activeItems.length;
  const averageAccuracy =
    activeCount > 0
      ? Math.round(activeItems.reduce((sum, item) => sum + (item.accuracy ?? 0), 0) / activeCount)
      : 0;

  return (
    <div className="relative min-h-screen overflow-hidden bg-cream font-cartoon text-ink">
      <BackgroundDecor />

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        {/* 顶栏 */}
        <div className="mb-8 flex items-center justify-between">
          <Link href="/" className="ink-btn ink-btn-white px-4 py-2 text-sm">
            ← 回首页
          </Link>
          <span className="ink-pill rotate-2 bg-white">
            <StarDoodle className="h-3.5 w-3.5" />
            错题复习本
          </span>
        </div>

        {/* 标题 */}
        <header className="mb-8 flex items-start gap-4">
          <Mascot className="h-20 w-20 shrink-0 -rotate-6 animate-bounce-soft" />
          <div>
            <h1 className="text-3xl font-black leading-tight sm:text-4xl">
              错题<span className="text-cartoon-orange">小本本</span> 🔥
            </h1>
            <p className="mt-2 text-sm font-bold text-ink/65">
              第一次答错就会住进来。句子练到 70% 以上、单词答对 3 次就毕业。
            </p>
          </div>
        </header>

        {/* Tab */}
        <div className="mb-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              setTab('sentences');
              setConfirming(false);
            }}
            aria-pressed={tab === 'sentences'}
            className={`ink-btn py-3 text-sm ${tab === 'sentences' ? 'bg-lemon' : 'ink-btn-white'}`}
          >
            <BookOpen size={17} strokeWidth={3} />
            句子
            <span className="grid h-5 min-w-5 place-items-center rounded-full border-2 border-ink bg-white px-1 text-[10px]">
              {sentences.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('words');
              setConfirming(false);
            }}
            aria-pressed={tab === 'words'}
            className={`ink-btn py-3 text-sm ${tab === 'words' ? 'bg-lemon' : 'ink-btn-white'}`}
          >
            <SpellCheck size={17} strokeWidth={3} />
            单词
            <span className="grid h-5 min-w-5 place-items-center rounded-full border-2 border-ink bg-white px-1 text-[10px]">
              {words.length}
            </span>
          </button>
        </div>

        {loading ? (
          <div className="ink-card flex flex-col items-center gap-4 py-20">
            <Mascot className="h-16 w-16 animate-bounce-soft" />
            <p className="font-black text-ink/50">正在翻开错题本…</p>
          </div>
        ) : activeCount === 0 ? (
          <div className="ink-card relative flex flex-col items-center gap-4 px-6 py-16 text-center">
            <div className="text-6xl">🎉</div>
            <h2 className="text-2xl font-black">
              {tab === 'words' ? '单词本暂时是空的' : '句子本暂时是空的'}
            </h2>
            <p className="max-w-xs text-sm font-bold text-ink/60">
              {tab === 'words'
                ? '答错单词后会自动出现在这里，练对 3 次就毕业。'
                : '第一次答错的句子会出现在这里，继续保持～'}
            </p>
            <Link href="/" className="ink-btn ink-btn-primary mt-2 px-6 py-3">
              去练习 →
            </Link>
          </div>
        ) : (
          <>
            {/* 统计 + 清空 */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <span className="ink-pill bg-white">
                  共 {activeCount} {tab === 'words' ? '词' : '句'}
                </span>
                <span className="ink-pill bg-lemon">平均正确率 {averageAccuracy}%</span>
              </div>

              <AnimatePresence mode="wait" initial={false}>
                {confirming ? (
                  <motion.div
                    key="confirm"
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className="flex items-center gap-2"
                  >
                    <span className="text-xs font-black text-cartoon-coral">
                      只清{tab === 'words' ? '单词' : '句子'}记录，确定？
                    </span>
                    <button
                      onClick={handleClear}
                      disabled={clearing}
                      className="ink-btn px-3 py-1.5 text-xs"
                      style={{ background: '#FF8A80', color: '#fff' }}
                    >
                      {clearing ? '清空中…' : '确定删除'}
                    </button>
                    <button
                      onClick={() => setConfirming(false)}
                      disabled={clearing}
                      className="ink-btn ink-btn-white px-3 py-1.5 text-xs"
                    >
                      取消
                    </button>
                  </motion.div>
                ) : (
                  <motion.button
                    key="clear"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setConfirming(true)}
                    className="ink-btn ink-btn-white px-3 py-1.5 text-xs text-cartoon-coral"
                  >
                    <Trash2 size={13} strokeWidth={3} />
                    清空{tab === 'words' ? '单词' : '句子'}错题
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {tab === 'words' ? (
              <>
                <div className="mb-4 flex justify-end">
                  <Link href={reviewAllWordsHref()} className="ink-btn ink-btn-yellow px-4 py-2 text-sm">
                    <RotateCcw size={15} strokeWidth={3} /> 复习全部单词
                  </Link>
                </div>
                <ul className="space-y-4">
                  {words.map((w, i) => {
                    const tone = accuracyTone(w.accuracy ?? 0);
                    return (
                      <motion.li
                        key={w.word}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: Math.min(i * 0.04, 0.4) }}
                      >
                        <div className="ink-card p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="break-words font-mono text-2xl font-black">{w.word}</p>
                              {w.phonetic && (
                                <p className="mt-0.5 font-mono text-xs font-bold text-cartoon-blue">
                                  /{w.phonetic}/
                                </p>
                              )}
                              {w.translation && (
                                <p className="mt-1 break-words text-sm font-bold text-ink/60">
                                  {w.translation}
                                </p>
                              )}
                            </div>
                            <span className={`ink-pill ${LEVEL_COLOR[w.level] ?? 'bg-white'}`}>
                              {w.level}
                            </span>
                          </div>

                          <div className="mt-4 flex items-center gap-3">
                            <div className="h-4 flex-1 overflow-hidden rounded-full border-2 border-ink bg-white">
                              <div
                                className={`h-full ${tone.bar} transition-all`}
                                style={{ width: `${Math.max(w.accuracy ?? 0, 4)}%` }}
                              />
                            </div>
                            <span className={`text-sm font-black ${tone.text}`}>
                              {tone.face} {Math.round(w.accuracy ?? 0)}%
                            </span>
                          </div>

                          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="ink-pill bg-white">错 {w.wrong_count} 次</span>
                              <span className="ink-pill bg-white">练 {w.total_attempts} 次</span>
                              {w.last_attempt_at && (
                                <span className="text-[10px] font-bold text-ink/45">
                                  最近 {w.last_attempt_at.slice(0, 10)}
                                </span>
                              )}
                            </div>
                            <Link href={wordHref(w)} className="ink-btn ink-btn-yellow px-4 py-2 text-sm">
                              重练这个单词 <ArrowRight size={15} strokeWidth={3} />
                            </Link>
                          </div>
                        </div>
                      </motion.li>
                    );
                  })}
                </ul>
              </>
            ) : (
              <ul className="space-y-5">
                {sentences.map((s, i) => {
                  const acc = s.accuracy ?? 0;
                  const tone = accuracyTone(acc);
                  const cat = categoryMeta(s.category);
                  return (
                    <motion.li
                      key={s.id}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(i * 0.04, 0.4) }}
                    >
                      <div className="ink-card p-5">
                        <div className="flex items-start gap-3">
                          <div className="text-3xl leading-none">{cat.icon}</div>
                          <div className="min-w-0 flex-1">
                            <p className="break-words text-lg font-black leading-snug">{s.text}</p>
                            {s.zh && (
                              <p className="mt-1 break-words text-sm font-bold text-ink/60">{s.zh}</p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-3">
                          <div className="h-4 flex-1 overflow-hidden rounded-full border-2 border-ink bg-white">
                            <div
                              className={`h-full ${tone.bar} transition-all`}
                              style={{ width: `${Math.max(acc, 4)}%` }}
                            />
                          </div>
                          <span className={`text-sm font-black ${tone.text}`}>
                            {tone.face} {acc.toFixed(0)}%
                          </span>
                        </div>

                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`ink-pill ${LEVEL_COLOR[s.level] ?? 'bg-white'}`}>
                              {s.level}
                            </span>
                            <span className="ink-pill bg-white">{cat.label}</span>
                            <span className="ink-pill bg-white">
                              错过 {(s.total_attempts ?? 0) - (s.correct_count ?? 0)} 次
                            </span>
                          </div>
                          <Link
                            href={practiceHref(s)}
                            className="ink-btn ink-btn-yellow px-4 py-2 text-sm"
                          >
                            重练这一句 <RotateCcw size={15} strokeWidth={3} />
                          </Link>
                        </div>
                      </div>
                    </motion.li>
                  );
                })}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  );
}

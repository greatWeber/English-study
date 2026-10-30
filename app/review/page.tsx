'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { BackgroundDecor, Mascot, StarDoodle } from '@/components/cartoon';
import { CATEGORIES } from '@/lib/constants';
import type { Sentence } from '@/lib/type';

type ReviewSentence = Sentence & {
  total_attempts: number;
  correct_count: number;
  accuracy: number;
};

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
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/stats?type=review&limit=50')
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setSentences(data.sentences ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleClear() {
    setClearing(true);
    try {
      const res = await fetch('/api/records', { method: 'DELETE' });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      setSentences([]);
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

  return (
    <div className="relative min-h-screen overflow-hidden bg-cream font-cartoon text-ink">
      <BackgroundDecor />

      <div className="relative z-10 mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12">
        {/* 顶栏 */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="ink-btn ink-btn-white px-4 py-2 text-sm"
          >
            ← 回首页
          </Link>
          <span className="ink-pill rotate-2 bg-white">
            <StarDoodle className="h-3.5 w-3.5" />
            错题复习本
          </span>
        </div>

        {/* 标题 */}
        <header className="mb-10 flex items-start gap-4">
          <Mascot className="h-20 w-20 shrink-0 -rotate-6 animate-bounce-soft" />
          <div>
            <h1 className="text-3xl font-black leading-tight sm:text-4xl">
              错题<span className="text-cartoon-orange">小本本</span> 🔥
            </h1>
            <p className="mt-2 text-sm font-bold text-ink/60">
              正确率低于 70% 的句子会住在这里，练到 70% 以上就搬家
            </p>
          </div>
        </header>

        {loading ? (
          <div className="ink-card flex flex-col items-center gap-4 py-20">
            <Mascot className="h-16 w-16 animate-bounce-soft" />
            <p className="font-black text-ink/50">正在翻开错题本…</p>
          </div>
        ) : sentences.length === 0 ? (
          <div className="ink-card relative flex flex-col items-center gap-4 px-6 py-16 text-center">
            <div className="text-6xl">🎉</div>
            <h2 className="text-2xl font-black">本子是空的！</h2>
            <p className="max-w-xs text-sm font-bold text-ink/55">
              暂时没有错题。继续保持，或者去挑战更难的句子～
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
                <span className="ink-pill bg-white">共 {sentences.length} 句</span>
                <span className="ink-pill bg-lemon">
                  平均正确率{' '}
                  {Math.round(
                    sentences.reduce((sum, s) => sum + (s.accuracy ?? 0), 0) / sentences.length,
                  )}
                  %
                </span>
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
                      记录会全部删掉，确定？
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
                    🗑 清空错题本
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            {/* 列表 */}
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
                          <p className="break-words text-lg font-black leading-snug">
                            {s.text}
                          </p>
                          {s.zh && (
                            <p className="mt-1 break-words text-sm font-bold text-ink/55">
                              {s.zh}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* 正确率条 */}
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

                      {/* 底部：标签 + 操作 */}
                      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`ink-pill ${LEVEL_COLOR[s.level] ?? 'bg-white'}`}
                          >
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
                          重练这一句 ↻
                        </Link>
                      </div>
                    </div>
                  </motion.li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

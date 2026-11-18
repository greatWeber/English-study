'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BookOpen,
  Flame,
  RefreshCw,
  Star,
  SpellCheck,
  Target,
  TrendingUp,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { LEVELS, CATEGORIES, MODES, EXAMS, TRACKS } from '@/lib/constants';
import { Mascot, KeyCap, StarDoodle } from '@/components/cartoon';
import { BackgroundDecor } from '@/components/interactiveBackground';
import { OptionPill } from '@/components/optionPill';
import { GlobeIcon } from '@/components/globeIcon';
import { useHomePage, type ContentKind, type DashboardData } from '@/hooks/useHomePage';

/* 各等级选中时的配色，与练习页保持一致 */
const LEVEL_ACTIVE: Record<string, string> = {
  A1: 'bg-cartoon-mint',
  A2: 'bg-cloud',
  B1: 'bg-grape',
  B2: 'bg-cartoon-orange',
  C1: 'bg-cartoon-coral',
  C2: 'bg-[#F9A8D4]',
};

const COUNTS = ['10', '20', '30'];
const DAILY_GOAL = 20;

const CONTENT_META: Record<
  ContentKind,
  { icon: 'word' | 'globe'; title: string; desc: string }
> = {
  word: {
    icon: 'word',
    title: '单词默写',
    desc: '看中文和音标写单词，按学习路线抽词',
  },
  sentence: {
    icon: 'globe',
    title: '生活例句',
    desc: '真实场景例句，填空 / 整句默写',
  },
};

function DashboardPanel({
  dashboard,
  loading,
  hasLastSession,
  onResume,
}: {
  dashboard: DashboardData | null;
  loading: boolean;
  hasLastSession: boolean;
  onResume: () => void;
}) {
  if (loading) {
    return (
      <section className="ink-card mt-5 p-5 md:p-6">
        <div className="flex items-center gap-3">
          <Mascot className="h-12 w-12" />
          <div>
            <p className="text-sm font-extrabold">正在整理你的学习记录…</p>
            <p className="mt-0.5 text-xs font-bold text-ink/50">马上就好</p>
          </div>
        </div>
      </section>
    );
  }

  const hasHistory = Boolean(dashboard && dashboard.total.attempts > 0);
  const todayAttempts = dashboard?.today.attempts ?? 0;
  const goalProgress = Math.min(Math.round((todayAttempts / DAILY_GOAL) * 100), 100);
  const reviewTotal = (dashboard?.review.sentences ?? 0) + (dashboard?.review.words ?? 0);
  const maxDay = Math.max(...(dashboard?.last7Days.map((d) => d.attempts) ?? [0]), 1);

  if (!hasHistory) {
    return (
      <section className="ink-card mt-5 overflow-hidden p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-4">
          <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border-[3px] border-ink bg-lemon text-2xl shadow-[3px_3px_0_0_#2B2B45]">
            🌱
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-extrabold">今天先练 10 分钟</h2>
            <p className="mt-1 text-xs font-bold text-ink/65">
              完成第一轮后，这里会出现连续天数、今日进度和待复习提醒。
            </p>
          </div>
          <button type="button" onClick={onResume} className="ink-btn ink-btn-primary px-5 py-3 text-sm">
            开始第一轮 <ArrowRight size={17} strokeWidth={3} />
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="ink-card mt-5 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-[3px] border-ink bg-[#FFFDF7] px-5 py-3.5 md:px-6">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl border-2 border-ink bg-lemon shadow-[2px_2px_0_0_#2B2B45]">
            <TrendingUp size={16} strokeWidth={3} />
          </span>
          <h2 className="text-sm font-extrabold">今天的学习</h2>
        </div>
        <span className="ink-pill bg-white text-[11px]">
          <Flame size={13} strokeWidth={3} className="text-cartoon-orange" />
          连续 {dashboard?.streak ?? 0} 天
        </span>
      </div>

      <div className="grid gap-5 p-5 md:grid-cols-[1.2fr_1fr] md:p-6">
        <div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-ink/65">今日目标</p>
              <p className="mt-1 text-2xl font-black">
                {todayAttempts}
                <span className="ml-1 text-sm font-extrabold text-ink/60">/ {DAILY_GOAL} 题</span>
              </p>
            </div>
            <span className="text-sm font-black text-cartoon-orange">{goalProgress}%</span>
          </div>
          <div className="mt-2 h-4 overflow-hidden rounded-full border-[3px] border-ink bg-white">
            <div
              className="h-full rounded-full bg-[repeating-linear-gradient(45deg,#FFB26B_0px,#FFB26B_9px,#FFD166_9px,#FFD166_18px)] transition-all duration-500"
              style={{ width: `${Math.max(goalProgress, 3)}%` }}
            />
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            {[
              { label: '今日正确率', value: `${dashboard?.today.accuracy ?? 0}%` },
              { label: '累计题数', value: `${dashboard?.total.attempts ?? 0}` },
              { label: '待复习', value: `${reviewTotal}` },
            ].map((item) => (
              <div key={item.label} className="rounded-xl border-2 border-ink/15 bg-cream/70 px-2 py-2.5 text-center">
                <p className="text-lg font-black">{item.value}</p>
                <p className="mt-0.5 text-[10px] font-extrabold text-ink/65">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {hasLastSession && (
              <button type="button" onClick={onResume} className="ink-btn ink-btn-primary px-4 py-2.5 text-xs">
                <ArrowRight size={15} strokeWidth={3} /> 继续上次
              </button>
            )}
            {reviewTotal > 0 && (
              <Link href="/review" className="ink-btn ink-btn-white px-4 py-2.5 text-xs">
                <Star size={15} strokeWidth={3} /> 去复习 {reviewTotal} 项
              </Link>
            )}
          </div>
        </div>

        <div className="rounded-2xl border-2 border-dashed border-ink/20 bg-[#FFFDF7] p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-black uppercase tracking-wider text-ink/65">最近 7 天</p>
            <span className="text-[10px] font-bold text-ink/60">每天一点点</span>
          </div>
          <div className="mt-3 flex h-24 items-end justify-between gap-1.5">
            {dashboard?.last7Days.map((day) => {
              const height = Math.max(Math.round((day.attempts / maxDay) * 100), 4);
              const date = new Date(`${day.date}T00:00:00`);
              return (
                <div key={day.date} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <div className="flex h-20 w-full items-end">
                    <div
                      className={`w-full rounded-t-md border-2 border-ink ${
                        day.attempts > 0 ? 'bg-cartoon-mint' : 'bg-ink/10'
                      }`}
                      style={{ height: `${height}%` }}
                      title={`${day.date} · ${day.attempts} 题`}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-ink/60">
                    {date.toLocaleDateString('zh-CN', { weekday: 'short' }).replace('周', '')}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function HomePage() {
  const {
    loading,
    track,
    exam,
    content,
    level,
    category,
    mode,
    count,
    sentenceDataset,
    wordBank,
    dashboard,
    dashboardLoading,
    hasLastSession,
    reviewHref,
    setTrack,
    setExam,
    setContent,
    setLevel,
    setCategory,
    setMode,
    setCount,
    handleStart,
    resetSettings,
  } = useHomePage();

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream font-cartoon text-ink">
        <BackgroundDecor />
        <div className="relative z-10 flex flex-col items-center gap-5">
          <Mascot className="h-24 w-24" />
          <div className="rounded-2xl border-[3px] border-ink bg-white px-6 py-3 text-sm font-extrabold shadow-[4px_4px_0_0_#2B2B45]">
            正在准备练习本…
          </div>
        </div>
      </div>
    );
  }

  const hasSentenceData = Number(sentenceDataset?.sentence_count ?? 0) > 0;
  const categoryMeta = CATEGORIES.find((c) => c.id === category);
  const modeLabel = MODES.find((m) => m.id === mode)?.label ?? '填空题';
  const examMeta = EXAMS.find((e) => e.id === exam);
  const trackMeta = TRACKS.find((t) => t.id === track) ?? TRACKS[0];
  const levelLabel = level === 'all' ? '全部等级' : level;
  const wordListLabel = examMeta?.label ?? levelLabel;
  const campusExams = EXAMS.filter((item) => item.group === 'campus');
  const examExams = EXAMS.filter((item) => item.group === 'exam');
  const reviewTotal = (dashboard?.review.sentences ?? 0) + (dashboard?.review.words ?? 0);

  return (
    <div className="relative min-h-screen overflow-hidden bg-cream font-cartoon text-ink">
      <BackgroundDecor />

      {/* 顶部 */}
      <header className="relative z-20 mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-5 md:px-6">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 -rotate-3 place-items-center rounded-2xl border-[3px] border-ink bg-lemon shadow-[3px_3px_0_0_#2B2B45]">
            <Mascot className="h-9 w-9" />
          </span>
          <span>
            <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-ink/65">
              Dictation Fun
            </span>
            <span className="block text-lg font-extrabold leading-tight md:text-xl">
              英语默写练习站
            </span>
          </span>
        </div>

        <Link href={reviewHref} className="ink-btn ink-btn-white px-3 py-2 text-xs">
          <Star size={15} strokeWidth={3} fill="currentColor" />
          错题复习本
          {reviewTotal > 0 && (
            <span className="grid h-5 min-w-5 place-items-center rounded-full bg-cartoon-coral px-1 text-[10px] text-white">
              {reviewTotal}
            </span>
          )}
        </Link>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-2 pt-7 text-center md:px-6 md:pt-10">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <span className="ink-pill border-ink bg-white shadow-[3px_3px_0_0_#2B2B45]">
            <BookOpen size={14} strokeWidth={3} />
            单词 × 例句 · 每天进步一点点
          </span>
          <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-black leading-tight tracking-tight md:text-6xl">
            Dictation{' '}
            <span className="relative inline-block text-cartoon-orange">
              Fun
              <StarDoodle className="absolute -right-6 -top-4 h-6 w-6 text-lemon" />
            </span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm font-bold text-ink/65 md:text-base">
            选一条适合你的学习路线：校园成长打基础，考试冲刺对准目标词表。
          </p>
        </motion.div>
        <Mascot className="mx-auto mt-4 h-24 w-24 md:h-28 md:w-28" />
      </section>

      {/* 主体 */}
      <main className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-28 md:px-6 md:pb-16">
        <DashboardPanel
          dashboard={dashboard}
          loading={dashboardLoading}
          hasLastSession={hasLastSession}
          onResume={handleStart}
        />

        {/* 学习路线 */}
        <section className="ink-card mt-5 p-5 md:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg border-2 border-ink bg-cloud text-sm shadow-[2px_2px_0_0_#2B2B45]">
                🧭
              </span>
              <h2 className="text-sm font-extrabold">学习路线</h2>
            </div>
            <span className="text-[11px] font-bold text-ink/65">
              当前：{trackMeta.icon} {trackMeta.label}
              {examMeta ? ` · ${examMeta.label}` : ''}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {TRACKS.map((item) => {
              const active = track === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTrack(item.id)}
                  aria-pressed={active}
                  className={`flex items-center gap-3 rounded-2xl border-[3px] border-ink p-3.5 text-left transition-all ${
                    active
                      ? 'bg-lemon shadow-[4px_4px_0_0_#2B2B45]'
                      : 'bg-white shadow-[3px_3px_0_0_#2B2B45] hover:-translate-y-0.5'
                  }`}
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border-[3px] border-ink bg-white text-xl">
                    {item.icon}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-extrabold">{item.label}</span>
                    <span className="mt-0.5 block text-[11px] font-bold text-ink/65">{item.desc}</span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-4">
            <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-ink/65">词表</p>
            <div className="flex flex-wrap gap-2">
              {track === 'campus' && (
                <OptionPill active={!exam} activeClass="bg-cartoon-mint" onClick={() => setExam('')}>
                  CEFR 分级
                </OptionPill>
              )}
              {(track === 'campus' ? campusExams : examExams).map((item) => (
                <OptionPill
                  key={item.id}
                  active={exam === item.id}
                  activeClass={track === 'campus' ? 'bg-cartoon-mint' : 'bg-grape'}
                  onClick={() => setExam(item.id)}
                >
                  {item.label}
                </OptionPill>
              ))}
            </div>
          </div>
        </section>

        <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* 默写内容 */}
          <section className="lg:col-span-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="grid h-7 w-7 place-items-center rounded-lg border-2 border-ink bg-lemon text-sm shadow-[2px_2px_0_0_#2B2B45]">
                📚
              </span>
              <h2 className="text-sm font-extrabold">默写内容</h2>
            </div>

            <div className="space-y-3">
              {(Object.keys(CONTENT_META) as ContentKind[]).map((key) => {
                const meta = CONTENT_META[key];
                const active = content === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setContent(key)}
                    aria-pressed={active}
                    className={`group relative flex w-full items-center gap-3 rounded-2xl border-[3px] border-ink p-4 text-left transition-all duration-100 ${
                      active
                        ? 'bg-lemon shadow-[4px_4px_0_0_#2B2B45]'
                        : 'bg-white shadow-[3px_3px_0_0_#2B2B45] hover:-translate-y-0.5 hover:shadow-[4px_4px_0_0_#2B2B45]'
                    }`}
                  >
                    <span
                      className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl border-[3px] border-ink ${
                        active ? 'bg-white' : 'bg-cream'
                      }`}
                    >
                      {meta.icon === 'globe' ? (
                        <GlobeIcon size={20} strokeWidth={2.4} />
                      ) : (
                        <SpellCheck size={20} strokeWidth={2.6} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-extrabold">{meta.title}</span>
                      <span className="mt-0.5 block truncate text-[11px] font-bold text-ink/65">
                        {meta.desc}
                      </span>
                    </span>
                    {key === 'sentence' && sentenceDataset?.sentence_count != null && (
                      <span
                        className={`ink-pill shrink-0 py-0.5 text-[10px] ${
                          active ? 'bg-white' : 'bg-cream'
                        }`}
                      >
                        {sentenceDataset.sentence_count} 题
                      </span>
                    )}
                    {key === 'word' && wordBank != null && (
                      <span
                        className={`ink-pill shrink-0 py-0.5 text-[10px] ${
                          active ? 'bg-white' : 'bg-cream'
                        }`}
                      >
                        {wordBank} 词
                      </span>
                    )}
                    {active && (
                      <span className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border-[3px] border-ink bg-cartoon-mint text-[11px] font-black shadow-[2px_2px_0_0_#2B2B45]">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>

          {/* 设置 + 开始 */}
          <section className="space-y-5 lg:col-span-8">
            <div className="ink-card p-5 md:p-6">
              <div className="mb-4 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg border-2 border-ink bg-cloud text-sm shadow-[2px_2px_0_0_#2B2B45]">
                  ⚙️
                </span>
                <h2 className="text-sm font-extrabold">练习设置</h2>
              </div>

              <div className="grid grid-cols-1 gap-5">
                {content === 'word' && !exam && (
                  <div>
                    <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-ink/65">
                      CEFR 等级
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <OptionPill
                        active={level === 'all'}
                        activeClass="bg-ink text-white"
                        onClick={() => setLevel('all')}
                      >
                        全部
                      </OptionPill>
                      {LEVELS.map((lv) => (
                        <OptionPill
                          key={lv.id}
                          active={level === lv.id}
                          activeClass={LEVEL_ACTIVE[lv.id] ?? 'bg-lemon'}
                          onClick={() => setLevel(lv.id)}
                        >
                          {lv.id}
                        </OptionPill>
                      ))}
                    </div>
                  </div>
                )}

                {content === 'word' && exam && (
                  <div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed border-ink/20 bg-cream/60 px-3 py-2.5">
                    <Target size={16} strokeWidth={3} className="text-cartoon-orange" />
                    <span className="text-sm font-extrabold">{examMeta?.label} 核心词</span>
                    <span className="text-[11px] font-bold text-ink/65">
                      抽题只来自这张考试词表，不再叠加 CEFR 过滤
                    </span>
                  </div>
                )}

                {content === 'word' && (
                  <div>
                    <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-ink/65">
                      每轮词数
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {COUNTS.map((c) => (
                        <OptionPill
                          key={c}
                          active={count === c}
                          activeClass="bg-cartoon-mint"
                          onClick={() => setCount(c)}
                        >
                          {c} 个
                        </OptionPill>
                      ))}
                    </div>
                  </div>
                )}

                {content === 'sentence' && (
                  <>
                    <div>
                      <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-ink/65">
                        等级
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <OptionPill active={level === 'all'} onClick={() => setLevel('all')}>
                          全部
                        </OptionPill>
                        {LEVELS.map((lv) => (
                          <OptionPill
                            key={lv.id}
                            active={level === lv.id}
                            activeClass={LEVEL_ACTIVE[lv.id] ?? 'bg-lemon'}
                            onClick={() => setLevel(lv.id)}
                          >
                            {lv.id}
                          </OptionPill>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-ink/65">
                        场景
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <OptionPill active={category === 'all'} onClick={() => setCategory('all')}>
                          全部
                        </OptionPill>
                        {CATEGORIES.map((c) => (
                          <OptionPill
                            key={c.id}
                            active={category === c.id}
                            onClick={() => setCategory(c.id)}
                          >
                            {c.icon} {c.label}
                          </OptionPill>
                        ))}
                      </div>
                    </div>

                    <div>
                      <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-ink/65">
                        模式
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {MODES.map((m) => (
                          <OptionPill
                            key={m.id}
                            active={mode === m.id}
                            activeClass={m.id === 'fill' ? 'bg-cloud' : 'bg-grape'}
                            onClick={() => setMode(m.id)}
                          >
                            {m.label}
                          </OptionPill>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 开始卡 */}
            <div className="ink-card relative overflow-hidden p-6 text-center md:p-8">
              {content === 'sentence' && !hasSentenceData ? (
                <div className="relative z-10 flex flex-col items-center gap-3 py-2">
                  <span className="grid h-16 w-16 place-items-center rounded-2xl border-[3px] border-ink bg-lemon text-3xl shadow-[4px_4px_0_0_#2B2B45]">
                    📭
                  </span>
                  <p className="text-lg font-extrabold">例句库还在准备中</p>
                  <p className="max-w-sm text-sm font-bold text-ink/60">
                    先试试单词默写吧，例句内容很快会补上。
                  </p>
                </div>
              ) : (
                <div className="relative z-10">
                  <Mascot className="mx-auto h-20 w-20" />
                  <p className="mt-2 text-sm font-bold text-ink/65">
                    准备好了吗？点击开始你的默写之旅 ✏️
                  </p>

                  <div className="mx-auto mt-4 flex max-w-lg flex-wrap items-center justify-center gap-2">
                    {content === 'word' ? (
                      <>
                        <span className="ink-pill bg-cream py-1 text-[11px]">📝 单词默写</span>
                        <span className="ink-pill bg-cream py-1 text-[11px]">🎯 {wordListLabel}</span>
                        <span className="ink-pill bg-cream py-1 text-[11px]">🔢 每轮 {count} 词</span>
                      </>
                    ) : (
                      <>
                        <span className="ink-pill bg-cream py-1 text-[11px]">🌍 生活例句</span>
                        <span className="ink-pill bg-cream py-1 text-[11px]">🎯 {levelLabel}</span>
                        <span className="ink-pill bg-cream py-1 text-[11px]">
                          {categoryMeta ? `${categoryMeta.icon} ${categoryMeta.label}` : '🌐 全部场景'}
                        </span>
                        <span className="ink-pill bg-cream py-1 text-[11px]">✏️ {modeLabel}</span>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleStart}
                    disabled={content === 'sentence' && !sentenceDataset}
                    className="ink-btn ink-btn-primary mt-6 w-full py-4 text-base lg:w-auto lg:px-10"
                  >
                    开始练习 <ArrowRight size={20} strokeWidth={3} />
                  </button>

                  <p className="mt-4 hidden flex-wrap items-center justify-center gap-1.5 text-[11px] font-bold text-ink/65 sm:flex">
                    <KeyCap>Enter</KeyCap> 检查
                    <span className="text-ink/25">·</span>
                    <KeyCap>⌘Enter</KeyCap> 看答案
                    <span className="text-ink/25">·</span>
                    <KeyCap>Esc</KeyCap> 重写
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* 底部导航 */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link href={reviewHref} className="ink-btn ink-btn-white py-4">
            <Star size={18} strokeWidth={3} />
            错题复习本
          </Link>
          <button type="button" onClick={resetSettings} className="ink-btn ink-btn-white py-4">
            <RefreshCw size={18} strokeWidth={3} />
            重置筛选
          </button>
        </div>
      </main>

      {/* 移动端底部开始按钮 */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t-[3px] border-ink bg-cream/95 p-3 backdrop-blur sm:hidden">
        <button type="button" onClick={handleStart} className="ink-btn ink-btn-primary w-full py-3.5 text-base">
          开始练习 <ArrowRight size={18} strokeWidth={3} />
        </button>
      </div>
    </div>
  );
}

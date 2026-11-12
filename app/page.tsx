'use client';

import Link from 'next/link';
import { ArrowRight, BookOpen, RefreshCw, Star, SpellCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { LEVELS, CATEGORIES, MODES } from '@/lib/constants';
import { Mascot, KeyCap, StarDoodle } from '@/components/cartoon';
import { BackgroundDecor } from '@/components/interactiveBackground';
import { OptionPill } from '@/components/optionPill';
import { GlobeIcon } from '@/components/globeIcon';
import { useHomePage, type ContentKind } from '@/hooks/useHomePage';



/* 各等级选中时的配色，与练习页保持一致 */
const LEVEL_ACTIVE: Record<string, string> = {
  A1: 'bg-cartoon-mint',
  A2: 'bg-cloud',
  B1: 'bg-grape',
  B2: 'bg-cartoon-orange',
  C1: 'bg-cartoon-coral',
  C2: 'bg-[#F9A8D4]',
};

/* 每轮词数选项 */
const COUNTS = ['10', '20', '30'];

/* 默写内容两种选择的元信息 */
const CONTENT_META: Record<
  ContentKind,
  { icon: 'word' | 'globe'; title: string; desc: string; badge?: string }
> = {
  word: {
    icon: 'word',
    title: '单词默写',
    desc: '按 CEFR 等级抽词，看中文和音标写单词',
  },
  sentence: {
    icon: 'globe',
    title: 'Tatoeba 例句默写',
    desc: '真实生活例句，填空 / 整句默写',
  },
};

export default function HomePage() {

  const {
    loading,
    content,
    level,
    category,
    mode,
    count,
    sentenceDataset,
    wordBank,
    setContent,
    setLevel,
    setCategory,
    setMode,
    setCount,
    handleStart,
  } = useHomePage();

  if (loading) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-cream font-cartoon text-ink">
        <BackgroundDecor />
        <div className="relative z-10 flex flex-col items-center gap-5">
          <Mascot className="h-24 w-24 animate-float" />
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
            <span className="block text-[10px] font-black uppercase tracking-[0.22em] text-ink/40">
              Dictation Fun
            </span>
            <span className="block text-lg font-extrabold leading-tight md:text-xl">
              英语默写练习站
            </span>
          </span>
        </div>

        <Link href="/review" className="ink-btn ink-btn-white px-3 py-2 text-xs">
          <Star size={15} strokeWidth={3} fill="currentColor" />
          错题复习本
        </Link>
      </header>

      {/* Hero */}
      <section className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-4 pt-8 text-center md:px-6 md:pt-12">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <span className="ink-pill border-ink bg-white shadow-[3px_3px_0_0_#2B2B45]">
            <BookOpen size={14} strokeWidth={3} />
            单词 × 例句 按等级开练
          </span>
          <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-black leading-tight tracking-tight md:text-6xl">
            Dictation{' '}
            <span className="relative inline-block text-cartoon-orange">
              Fun
              <StarDoodle className="absolute -right-6 -top-4 h-6 w-6 text-lemon" />
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm font-bold text-ink/55 md:text-base">
            选「单词默写」刷词汇量，选「例句默写」练真实句子，错题自动进入复习本 ✏️
          </p>
        </motion.div>
        <Mascot className="mx-auto mt-6 h-28 w-28 animate-float md:h-32 md:w-32" />
      </section>

      {/* 主体 */}
      <main className="relative z-10 mx-auto w-full max-w-5xl px-4 pb-16 md:px-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
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
                      <span className="mt-0.5 block truncate text-[11px] font-bold text-ink/45">
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
          <section className="space-y-6 lg:col-span-8">
            <div className="ink-card p-5 md:p-6">
              <div className="mb-4 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg border-2 border-ink bg-cloud text-sm shadow-[2px_2px_0_0_#2B2B45]">
                  ⚙️
                </span>
                <h2 className="text-sm font-extrabold">练习设置</h2>
              </div>

              <div className="grid grid-cols-1 gap-5 ">
                {/* 等级 */}
                <div>
                  <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-ink/40">
                    等级
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

                {/* 每轮词数（仅单词默写） */}
                {content === 'word' && (
                  <div>
                    <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-ink/40">
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

                {/* 场景 + 模式（仅例句默写） */}
                {content === 'sentence' && (
                  <>
                    <div>
                      <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-ink/40">
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
                      <p className="mb-2 text-[11px] font-black uppercase tracking-wider text-ink/40">
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
                  <p className="text-lg font-extrabold">暂无题目数据</p>
                  <p className="text-sm font-bold text-ink/50">
                    请先运行{' '}
                    <code className="rounded-lg border-2 border-ink/15 bg-cream px-2 py-0.5 font-cartoon text-xs">
                      npm run import:data
                    </code>{' '}
                    导入语料库
                  </p>
                </div>
              ) : (
                <div className="relative z-10">
                  <Mascot className="mx-auto h-20 w-20 animate-float" />
                  <p className="mt-2 text-sm font-bold text-ink/55">
                    准备好了吗？点击开始你的默写之旅 ✏️
                  </p>

                  <div className="mx-auto mt-4 flex max-w-lg flex-wrap items-center justify-center gap-2">
                    {content === 'word' ? (
                      <>
                        <span className="ink-pill bg-cream py-1 text-[11px]">📝 单词默写</span>
                        <span className="ink-pill bg-cream py-1 text-[11px]">
                          🎯 {level === 'all' ? '全部等级' : level}
                        </span>
                        <span className="ink-pill bg-cream py-1 text-[11px]">🔢 每轮 {count} 词</span>
                      </>
                    ) : (
                      <>
                        <span className="ink-pill bg-cream py-1 text-[11px]">
                          🌍 {sentenceDataset?.name ?? '—'}
                        </span>
                        <span className="ink-pill bg-cream py-1 text-[11px]">
                          🎯 {level === 'all' ? '全部等级' : level}
                        </span>
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

                  <p className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-[11px] font-bold text-ink/40">
                    <KeyCap>Enter</KeyCap> 检查
                    <span className="text-ink/20">·</span>
                    <KeyCap>⌘Enter</KeyCap> 看答案
                    <span className="text-ink/20">·</span>
                    <KeyCap>Esc</KeyCap> 重写
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* 底部导航 */}
        <div className="mt-6 grid grid-cols-2 gap-3">
          <Link href="/review" className="ink-btn ink-btn-white py-4">
            <Star size={18} strokeWidth={3} />
            错题复习本
          </Link>
          <button type="button" onClick={() => window.location.reload()} className="ink-btn ink-btn-white py-4">
            <RefreshCw size={18} strokeWidth={3} />
            重新筛选
          </button>
        </div>
      </main>
    </div>
  );
}

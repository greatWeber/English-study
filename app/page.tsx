'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ArrowRight, BookOpen, RefreshCw, Zap, Star, EyeOff, Play } from 'lucide-react';
import { motion } from 'framer-motion';
import { LEVELS, CATEGORIES, MODES } from '@/lib/constants';

type Dataset = {
  id: string;
  name: string;
  source: string;
  description?: string;
  sentence_count?: number;
};

export default function HomePage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDataset, setSelectedDataset] = useState<string | null>(null);
  const [level, setLevel] = useState<string>('all');
  const [category, setCategory] = useState<string>('all');
  const [mode, setMode] = useState<string>('fill');

  useEffect(() => {
    fetch('/api/datasets')
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.datasets.length) {
          setDatasets(data.datasets);
          setSelectedDataset(data.datasets[0].id);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleStart = () => {
    if (!selectedDataset) return;
    const url = new URL('/practice', window.location.origin);
    url.searchParams.set('dataset', selectedDataset);
    url.searchParams.set('level', level);
    url.searchParams.set('category', category);
    url.searchParams.set('mode', mode);
    window.location.href = url.toString();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cartoon-yellow/10">
        <motion.div
          animate={{ rotate: [0, 360] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
          className="w-12 h-12 border-4 border-cartoon-orange border-t-transparent rounded-full"
        />
      </div>
    );
  }

  const hasData = datasets.some((d) => Number(d.sentence_count) > 0);

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-cartoon-orange/20 to-transparent z-0" />
      <div className="absolute top-20 left-[-10%] w-96 h-96 bg-cartoon-mint/40 rounded-full blur-3xl -z-10 animate-float" />
      <div className="absolute top-40 right-[-10%] w-96 h-96 bg-cartoon-blue/40 rounded-full blur-3xl -z-10 animate-float" style={{ animationDelay: '-1.5s' }} />
      <div className="absolute bottom-0 left-1/2 w-72 h-72 bg-cartoon-indigo/30 rounded-full blur-[100px] -z-10" />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-12">
        {/* 头部 */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/60 backdrop-blur border border-white/80 text-cartoon-orange font-bold text-sm mb-4 shadow-sm">
            <BookOpen size={18} strokeWidth={2} />
            英语默写练习
          </div>
          <h1 className="text-5xl md:text-6xl font-extrabold text-cartoon-dark tracking-tight mb-4 bg-gradient-to-r from-cartoon-orange via-cartoon-coral to-cartoon-indigo bg-clip-text text-transparent">
            Dictation Fun
          </h1>
          <p className="text-lg text-cartoon-dark/70 max-w-xl mx-auto">
            按等级与场景挑题，键盘填空 / 整句默写，错题自动进入复习本
          </p>
        </div>

        {/* 控制面板 */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
          {/* 左侧：数据集选择 */}
          <div className="lg:col-span-4 space-y-4">
            <h3 className="text-sm font-semibold text-cartoon-dark tracking-wide uppercase">选择语料库</h3>
            <div className="space-y-2">
              {datasets.map((ds) => {
                const active = selectedDataset === ds.id;
                return (
                  <button
                    key={ds.id}
                    onClick={() => setSelectedDataset(ds.id)}
                    className={`w-full py-4 rounded-2xl border-2 transition-all duration-200 text-left ${
                      active
                        ? 'bg-cartoon-orange/10 border-cartoon-orange shadow-[0_0_0_4px_rgba(255,178,107,0.2)]'
                        : 'bg-white border-cartoon-blue/20 hover:border-cartoon-mint hover:bg-cartoon-yellow/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
                        {ds.source === 'tatoeba' ? (
                          <GlobeIcon size={20} strokeWidth={2} />
                        ) : (
                          <Zap size={20} strokeWidth={2} />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-cartoon-dark">{ds.name}</div>
                        <div className="text-xs text-cartoon-muted">
                          {ds.description || ''}
                          {ds.sentence_count != null ? ` · ${ds.sentence_count} 题` : ''}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 右侧：筛选 */}
          <div className="lg:col-span-8 space-y-6">
            <div className="card p-6">
              <h3 className="text-sm font-semibold text-cartoon-dark mb-4 flex items-center gap-2">
                <Zap size={16} strokeWidth={2} />
                练习设置
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 等级 */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-cartoon-muted uppercase tracking-wider">等级</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setLevel('all')}
                      className={`chip ${level === 'all' ? 'active' : ''}`}
                    >
                      全部
                    </button>
                    {LEVELS.map((lv) => (
                      <button
                        key={lv.id}
                        onClick={() => setLevel(lv.id)}
                        className={`chip ${level === lv.id ? 'active' : ''}`}
                      >
                        {lv.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 场景 */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-cartoon-muted uppercase tracking-wider">场景</label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setCategory('all')}
                      className={`chip ${category === 'all' ? 'active' : ''}`}
                    >
                      全部
                    </button>
                    {CATEGORIES.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => setCategory(c.id)}
                        className={`chip ${category === c.id ? 'active' : ''}`}
                      >
                        {c.icon} {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 模式 */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-cartoon-muted uppercase tracking-wider">模式</label>
                  <div className="flex flex-wrap gap-2">
                    {MODES.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setMode(m.id)}
                        className={`chip ${mode === m.id ? 'active' : ''}`}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 开始按钮 */}
            <div className="card p-8 text-center">
              {!hasData ? (
                <div className="flex flex-col items-center gap-3 text-cartoon-muted">
                  <EyeOff size={32} strokeWidth={2} />
                  <p className="font-medium">暂无题目数据</p>
                  <p className="text-sm">请先运行 <code className="bg-cartoon-yellow/20 px-2 py-0.5 rounded">npm run import:data</code> 导入语料库</p>
                </div>
              ) : (
                <>
                  <p className="text-sm text-cartoon-muted mb-6">准备好了吗？点击开始你的默写之旅 ✏️</p>
                  <button onClick={handleStart} className="btn-primary w-full lg:w-auto">
                    开始练习 <ArrowRight size={20} strokeWidth={2} />
                  </button>
                  <p className="mt-4 text-xs text-cartoon-muted">
                    空格/Tab 跳格 · Enter 判分 · ⌘/Ctrl+Enter 看答案
                  </p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* 功能导航 */}
        <div className="grid grid-cols-2 gap-4">
          <Link href="/review" className="btn-ghost flex items-center justify-center gap-2">
            <Star size={20} strokeWidth={2} />
            <span>错题复习本</span>
          </Link>
          <Link href="/" className="btn-ghost flex items-center justify-center gap-2">
            <RefreshCw size={20} strokeWidth={2} />
            <span>重新筛选</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

function GlobeIcon({ size = 24, strokeWidth = 1 }: { size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="lucide lucide-globe"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10" />
    </svg>
  );
}

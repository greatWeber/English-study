'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Clock, Trash2, RefreshCw, Flame } from 'lucide-react';
import { motion } from 'framer-motion';
import type { Sentence } from '@/lib/type';

type ReviewSentence = Sentence & {
  total_attempts: number;
  correct_count: number;
  accuracy: number;
};

export default function ReviewPage() {
  const router = useRouter();
  const [sentences, setSentences] = useState<ReviewSentence[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/stats?type=review&limit=50')
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setSentences(data.sentences);
        setLoading(false);
      });
  }, []);

  const handlePractice = (s: ReviewSentence) => {
    const url = new URL('/practice', window.location.origin);
    url.searchParams.set('dataset', s.dataset_id);
    url.searchParams.set('level', s.level);
    url.searchParams.set('category', s.category);
    // 这里可以把这条句子作为单句练习，简单起见跳转到普通练习页
    window.location.href = url.toString();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cartoon-yellow/10">
        <RefreshCw className="w-10 h-10 text-cartoon-orange animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cartoon-yellow/10 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-cartoon-orange/30 to-transparent z-0" />

      <nav className="max-w-4xl mx-auto px-6 py-6 z-10">
        <div className="flex items-center gap-3">
          <ArrowRight size={20} strokeWidth={2} className="text-cartoon-orange" />
          <LinkBack className="font-bold text-cartoon-dark text-lg" />
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 pb-12">
        <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <Flame size={32} strokeWidth={2} className="text-cartoon-coral mr-2" />
            <h1 className="text-3xl font-bold text-cartoon-dark">错题复习本 🔥</h1>
            <p className="text-cartoon-muted">正确率低于 70% 的句子会出现在这里，建议每天复习一遍</p>
          </div>
          {sentences.length > 0 && (
            <button
              onClick={() => {
                fetch('/api/records', { method: 'DELETE' }).catch(console.error);
                setSentences([]);
              }}
              className="px-4 py-2 rounded-xl border border-cartoon-coral/30 bg-white text-cartoon-coral text-sm font-medium hover:bg-cartoon-coral/50 transition-all"
            >
              <Trash2 size={16} strokeWidth={2} className="mr-2" /> 清空错题本
            </button>
          )}
        </div>

        {sentences.length === 0 ? (
          <div className="card text-center py-20">
            <Clock size={48} strokeWidth={2} className="text-cartoon-blue/30 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-cartoon-dark mb-2">暂无错题 🎉</h2>
            <p className="text-cartoon-muted mb-6">继续练习，错题会自动记录在这里</p>
            <button
              onClick={() => router.push('/')}
              className="btn-primary"
            >
              去练习
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {sentences.map((s) => {
              const accuracy = s.accuracy ?? 0;
              const color =
                accuracy < 40 ? 'text-cartoon-coral' :
                accuracy < 70 ? 'text-cartoon-orange' :
                'text-green-600';
              return (
                <motion.div
                  key={s.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handlePractice(s)}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="text-2xl">{s.category === 'daily' ? '🏠' : s.category === 'travel' ? '✈️' : s.category === 'food' ? '🍽️' : s.category === 'shopping' ? '🛍️' : s.category === 'study' ? '📚' : s.category === 'work' ? '💼' : s.category === 'health' ? '🩺' : '💬'}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-cartoon-dark truncate">{s.text}</p>
                      <p className="text-xs text-cartoon-muted mt-1">{s.zh || ''}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex flex-col items-end">
                      <span className={`font-bold ${color}`}>{accuracy.toFixed(0)}%</span>
                      <span className="text-xs text-cartoon-muted">正确率</span>
                    </div>
                    <div className="flex flex-col items-end">
                      <span className="font-bold text-cartoon-dark">{s.total_attempts}</span>
                      <span className="text-xs text-cartoon-muted">做过</span>
                    </div>
                    <ArrowRight size={16} strokeWidth={2} className="text-cartoon-muted/50" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

function LinkBack({ className }: { className: string }) {
  if (typeof window === 'undefined') return <span className={className} />;
  return (
    <a
      href="/"
      onClick={(e) => {
        e.preventDefault();
        window.location.href = '/';
      }}
      className={className}
    >
      返回首页
    </a>
  );
}

import { useState, useEffect } from "react";

type Dataset = {
  id: string;
  name: string;
  source: string;
  description?: string;
  sentence_count?: number;
};

/** 首页「默写内容」两种选择：单词表 / Tatoeba 例句 */
export type ContentKind = 'word' | 'sentence';

export function useHomePage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState<ContentKind>('word');
  const [level, setLevel] = useState<string>('all');
  const [category, setCategory] = useState<string>('all');
  const [mode, setMode] = useState<string>('fill');
  const [count, setCount] = useState<string>('20');
  const [wordBank, setWordBank] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/datasets')
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.datasets.length) {
          setDatasets(data.datasets);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  // 词库徽标：跟随所选等级显示真实词数
  useEffect(() => {
    fetch(`/api/words?level=${encodeURIComponent(level)}&count=5`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && typeof data.total === 'number') setWordBank(data.total);
      })
      .catch(() => {});
  }, [level]);

  // 句子默写固定用 Tatoeba 真实例句库（内置精选语料已下架）
  const sentenceDataset =
    datasets.find((d) => d.source === 'tatoeba') ?? datasets[0] ?? null;

  const handleStart = () => {
    if (content === 'word') {
      const url = new URL('/word', window.location.origin);
      url.searchParams.set('level', level);
      url.searchParams.set('count', count);
      window.location.href = url.toString();
      return;
    }
    if (!sentenceDataset) return;
    const url = new URL('/practice', window.location.origin);
    url.searchParams.set('dataset', sentenceDataset.id);
    url.searchParams.set('level', level);
    url.searchParams.set('category', category);
    url.searchParams.set('mode', mode);
    window.location.href = url.toString();
  };

  return {
    datasets,
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
  };
}

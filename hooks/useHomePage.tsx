import { useState, useEffect, useCallback, useMemo } from "react";
import type { TrackId } from "@/lib/constants";

type Dataset = {
  id: string;
  name: string;
  source: string;
  description?: string;
  sentence_count?: number;
};

/** 首页「默写内容」两种选择：单词表 / 生活例句 */
export type ContentKind = 'word' | 'sentence';

export type DashboardData = {
  streak: number;
  today: { attempts: number; correct: number; accuracy: number };
  review: { sentences: number; words: number };
  total: { attempts: number; correct: number; accuracy: number; distinctSentencesPracticed: number };
  last7Days: Array<{ date: string; attempts: number; correct: number }>;
};

type StoredSettings = {
  track: TrackId;
  exam: string;
  content: ContentKind;
  level: string;
  category: string;
  mode: string;
  count: string;
};

const STORAGE_KEY = 'dictation:settings:v1';

const DEFAULTS: StoredSettings = {
  track: 'campus',
  exam: '',
  content: 'word',
  level: 'A2',
  category: 'all',
  mode: 'fill',
  count: '20',
};

function readStoredSettings(): StoredSettings | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredSettings>;
    return { ...DEFAULTS, ...parsed };
  } catch {
    return null;
  }
}

export function useHomePage() {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [loading, setLoading] = useState(true);
  const [track, setTrack] = useState<TrackId>(DEFAULTS.track);
  const [exam, setExam] = useState<string>(DEFAULTS.exam);
  const [content, setContent] = useState<ContentKind>(DEFAULTS.content);
  const [level, setLevel] = useState<string>(DEFAULTS.level);
  const [category, setCategory] = useState<string>(DEFAULTS.category);
  const [mode, setMode] = useState<string>(DEFAULTS.mode);
  const [count, setCount] = useState<string>(DEFAULTS.count);
  const [wordBank, setWordBank] = useState<number | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(true);
  const [settingsReady, setSettingsReady] = useState(false);
  const [hasLastSession, setHasLastSession] = useState(false);

  /* 恢复 URL / 本地设置 */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const stored = readStoredSettings();
    const hasUrlSettings = ['track', 'exam', 'content', 'level', 'category', 'mode', 'count'].some(
      (key) => params.has(key)
    );
    const next = stored ?? DEFAULTS;

    const trackParam = params.get('track');
    const nextTrack: TrackId = trackParam === 'exam' ? 'exam' : trackParam === 'campus' ? 'campus' : next.track;
    const nextExam = params.has('exam') ? params.get('exam') ?? '' : next.exam;
    const nextContent = params.get('content') === 'sentence' ? 'sentence' : params.get('content') === 'word' ? 'word' : next.content;

    setTrack(nextTrack);
    setExam(nextExam);
    setContent(nextContent);
    setLevel(params.get('level') ?? next.level);
    setCategory(params.get('category') ?? next.category);
    setMode(params.get('mode') === 'dictation' ? 'dictation' : params.get('mode') === 'fill' ? 'fill' : next.mode);
    setCount(params.get('count') ?? next.count);
    setHasLastSession(Boolean(stored) || hasUrlSettings);
    setSettingsReady(true);
  }, []);

  /* 设置持久化 + URL 同步，返回首页不丢筛选 */
  useEffect(() => {
    if (!settingsReady) return;
    const settings: StoredSettings = { track, exam, content, level, category, mode, count };
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      /* 隐私模式忽略 */
    }
    const url = new URL(window.location.href);
    url.searchParams.set('track', track);
    url.searchParams.set('exam', exam);
    url.searchParams.set('content', content);
    url.searchParams.set('level', level);
    url.searchParams.set('category', category);
    url.searchParams.set('mode', mode);
    url.searchParams.set('count', count);
    window.history.replaceState(null, '', url.toString());
  }, [settingsReady, track, exam, content, level, category, mode, count]);

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

  /* 词库徽标：跟随所选等级 / 考试词表显示真实词数 */
  useEffect(() => {
    const params = new URLSearchParams({ level, count: '5' });
    if (exam) params.set('exam', exam);
    fetch(`/api/words?${params.toString()}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && typeof data.total === 'number') setWordBank(data.total);
      })
      .catch(() => {});
  }, [level, exam]);

  const loadDashboard = useCallback(() => {
    setDashboardLoading(true);
    fetch('/api/dashboard')
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) {
          setDashboard({
            streak: data.streak ?? 0,
            today: data.today ?? { attempts: 0, correct: 0, accuracy: 0 },
            review: data.review ?? { sentences: 0, words: 0 },
            total: data.total ?? { attempts: 0, correct: 0, accuracy: 0, distinctSentencesPracticed: 0 },
            last7Days: data.last7Days ?? [],
          });
        }
      })
      .catch(() => {})
      .finally(() => setDashboardLoading(false));
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  // 句子默写固定用真实生活例句库（内置精选语料已下架）
  const sentenceDataset =
    datasets.find((d) => d.source === 'tatoeba') ?? datasets[0] ?? null;

  const changeTrack = useCallback((nextTrack: TrackId) => {
    setTrack(nextTrack);
    if (nextTrack === 'campus') {
      setExam('');
      setLevel('A2');
    } else {
      setExam('cet4');
      setLevel('all');
    }
  }, []);

  const changeExam = useCallback((nextExam: string) => {
    setExam(nextExam);
    setLevel(nextExam ? 'all' : 'A2');
  }, []);

  const handleStart = useCallback(() => {
    if (content === 'word') {
      const params = new URLSearchParams({ content: 'word', level, count });
      if (exam) params.set('exam', exam);
      window.location.href = `/word?${params.toString()}`;
      return;
    }
    if (!sentenceDataset) return;
    const params = new URLSearchParams({
      content: 'sentence',
      dataset: sentenceDataset.id,
      level,
      category,
      mode,
    });
    window.location.href = `/practice?${params.toString()}`;
  }, [content, level, count, exam, sentenceDataset, category, mode]);

  const resetSettings = useCallback(() => {
    setTrack(DEFAULTS.track);
    setExam(DEFAULTS.exam);
    setContent(DEFAULTS.content);
    setLevel(DEFAULTS.level);
    setCategory(DEFAULTS.category);
    setMode(DEFAULTS.mode);
    setCount(DEFAULTS.count);
    setHasLastSession(false);
  }, []);

  const reviewHref = useMemo(() => {
    if (!dashboard) return '/review';
    if (dashboard.review.words > 0 && dashboard.review.words >= dashboard.review.sentences) {
      return '/review?tab=words';
    }
    return '/review?tab=sentences';
  }, [dashboard]);

  return {
    datasets,
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
    setTrack: changeTrack,
    setExam: changeExam,
    setContent,
    setLevel,
    setCategory,
    setMode,
    setCount,
    handleStart,
    resetSettings,
    loadDashboard,
  };
}

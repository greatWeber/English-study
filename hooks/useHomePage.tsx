import { useState, useEffect } from "react";

type Dataset = {
  id: string;
  name: string;
  source: string;
  description?: string;
  sentence_count?: number;
};

export function useHomePage(){
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
              setSelectedDataset(data.datasets[1].id);
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

    return {
        datasets,
        loading,
        selectedDataset,
        level,
        category,
        mode,
        setDatasets,
        setLoading,
        setSelectedDataset,
        setLevel,
        setCategory,
        setMode,
        handleStart
    }
}
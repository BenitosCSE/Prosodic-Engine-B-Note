import { useState, useEffect, useMemo } from 'react';
import { analyzeText, ProsodyMetrics } from '../utils/prosodyEngine';

export interface SongSettings {
  bpm: number;
  beats: number;
  showMetrics: boolean;
  showStressHighlight: boolean;
  customDictionary: Record<string, number>;
}

export function useProsody(text: string, settings: SongSettings) {
  const [metrics, setMetrics] = useState<ProsodyMetrics | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    if (!text.trim()) {
      setMetrics(null);
      return;
    }

    setIsAnalyzing(true);
    const timer = setTimeout(() => {
      const result = analyzeText(text, settings.bpm, settings.beats, settings.customDictionary);
      setMetrics(result);
      setIsAnalyzing(false);
    }, 300);

    return () => clearTimeout(timer);
  }, [text, settings.bpm, settings.beats, settings.customDictionary]);

  return { metrics, isAnalyzing };
}

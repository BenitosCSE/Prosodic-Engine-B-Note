import { useMemo } from 'react';
import { analyzeText, ProsodyMetrics } from '../utils/prosodyEngine';
import { SongSettings } from './useSongSettings';

export type { SongSettings };

export function useProsody(text: string, settings: SongSettings) {
  const metrics = useMemo<ProsodyMetrics | null>(() => {
    if (!text.trim()) {
      return null;
    }
    return analyzeText(
      text,
      settings.bpm,
      settings.beats,
      settings.customDictionary,
      settings.subdivisions ?? 4
    );
  }, [text, settings.bpm, settings.beats, settings.customDictionary, settings.subdivisions]);

  return { metrics, isAnalyzing: false };
}


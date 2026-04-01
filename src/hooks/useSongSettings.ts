import { useState, useEffect } from 'react';

export interface SongSettings {
  bpm: number;
  beats: number;
  showMetrics: boolean;
  showStressHighlight: boolean;
  customDictionary: Record<string, number>;
}

const DEFAULT_SETTINGS: SongSettings = {
  bpm: 120,
  beats: 4,
  showMetrics: true,
  showStressHighlight: true,
  customDictionary: {},
};

const SETTINGS_KEY = 'b-note-song-settings';

export function useSongSettings() {
  const [settings, setSettings] = useState<SongSettings>(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      } catch (e) {
        console.error('Failed to parse song settings', e);
      }
    }
    return DEFAULT_SETTINGS;
  });

  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  const updateBPM = (bpm: number) => setSettings(s => ({ ...s, bpm: Math.max(40, Math.min(300, bpm)) }));
  const updateBeats = (beats: number) => setSettings(s => ({ ...s, beats }));
  const toggleMetrics = () => setSettings(s => ({ ...s, showMetrics: !s.showMetrics }));
  const toggleStress = () => setSettings(s => ({ ...s, showStressHighlight: !s.showStressHighlight }));
  const updateDictionary = (dict: Record<string, number>) => setSettings(s => ({ ...s, customDictionary: dict }));

  return {
    settings,
    updateBPM,
    updateBeats,
    toggleMetrics,
    toggleStress,
    updateDictionary
  };
}

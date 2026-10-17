import { useState, useEffect } from 'react';

export interface SongSettings {
  bpm: number;
  beats: number;
  subdivisions: number;
  showMetrics: boolean;
  showStressHighlight: boolean;
  metronome: boolean;
  customDictionary: Record<string, number>;
}

const DEFAULT_SETTINGS: SongSettings = {
  bpm: 120,
  beats: 4,
  subdivisions: 4,
  showMetrics: true,
  showStressHighlight: true,
  metronome: false,
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
  const updateSubdivisions = (subdivisions: number) => setSettings(s => ({ ...s, subdivisions }));
  const toggleMetrics = () => setSettings(s => ({ ...s, showMetrics: !s.showMetrics }));
  const toggleStress = () => setSettings(s => ({ ...s, showStressHighlight: !s.showStressHighlight }));
  const toggleMetronome = () => setSettings(s => ({ ...s, metronome: !s.metronome }));
  const updateDictionary = (dict: Record<string, number>) => setSettings(s => ({ ...s, customDictionary: dict }));

  return {
    settings,
    updateBPM,
    updateBeats,
    updateSubdivisions,
    toggleMetrics,
    toggleStress,
    toggleMetronome,
    updateDictionary
  };
}

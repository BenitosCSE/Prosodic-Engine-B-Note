import React from 'react';
import { SongSettings as SettingsType } from '../../hooks/useSongSettings';

interface SongSettingsProps {
  settings: SettingsType;
  onUpdateBPM: (bpm: number) => void;
  onUpdateBeats: (beats: number) => void;
  onToggleMetrics: () => void;
  onToggleStress: () => void;
}

const SongSettings: React.FC<SongSettingsProps> = ({
  settings, onUpdateBPM, onUpdateBeats, onToggleMetrics, onToggleStress
}) => {
  const beatsOptions = [2, 3, 4, 6, 8];

  return (
    <div className="flex flex-wrap items-center gap-6 px-6 py-4 bg-matte-gray/30 border-b border-white/5 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-black">BPM</label>
        <input 
          type="number"
          value={settings.bpm}
          onChange={(e) => onUpdateBPM(parseInt(e.target.value) || 120)}
          className="w-16 bg-black/40 border border-white/10 rounded px-2 py-1 text-sm font-mono text-orange-accent focus:outline-none focus:border-orange-accent/50"
          min={40}
          max={300}
        />
      </div>

      <div className="flex items-center gap-3">
        <label className="text-[10px] uppercase tracking-widest text-gray-500 font-black">Beats</label>
        <div className="flex bg-black/40 rounded border border-white/10 p-0.5">
          {beatsOptions.map(b => (
            <button
              key={b}
              onClick={() => onUpdateBeats(b)}
              className={`px-2 py-1 text-[10px] font-bold rounded transition-all ${settings.beats === b ? 'bg-orange-accent text-black shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-6 ml-auto">
        <button 
          onClick={onToggleMetrics}
          className="flex items-center gap-2 group"
        >
          <div className={`w-8 h-4 rounded-full relative transition-colors ${settings.showMetrics ? 'bg-orange-accent' : 'bg-zinc-800'}`}>
            <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all ${settings.showMetrics ? 'left-5' : 'left-1'}`} />
          </div>
          <span className="text-[10px] uppercase tracking-widest text-gray-500 font-black group-hover:text-gray-300 transition-colors">Metrics</span>
        </button>

        <button 
          onClick={onToggleStress}
          className="flex items-center gap-2 group"
        >
          <div className={`w-8 h-4 rounded-full relative transition-colors ${settings.showStressHighlight ? 'bg-orange-accent' : 'bg-zinc-800'}`}>
            <div className={`absolute top-1 w-2 h-2 rounded-full bg-white transition-all ${settings.showStressHighlight ? 'left-5' : 'left-1'}`} />
          </div>
          <span className="text-[10px] uppercase tracking-widest text-gray-500 font-black group-hover:text-gray-300 transition-colors">Stress</span>
        </button>
      </div>
    </div>
  );
};

export default SongSettings;

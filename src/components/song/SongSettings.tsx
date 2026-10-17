import React from 'react';
import { SongSettings as SettingsType } from '../../hooks/useSongSettings';

interface SongSettingsProps {
  settings: SettingsType;
  activeBeat?: number;
  onUpdateBPM: (bpm: number) => void;
  onUpdateBeats: (beats: number) => void;
  onUpdateSubdivisions: (sub: number) => void;
  onToggleMetrics: () => void;
  onToggleStress: () => void;
  onToggleMetronome: () => void;
}

const SongSettings: React.FC<SongSettingsProps> = ({
  settings, activeBeat = -1, onUpdateBPM, onUpdateBeats, onUpdateSubdivisions, onToggleMetrics, onToggleStress, onToggleMetronome
}) => {
  const beatsOptions = [2, 3, 4, 6, 8];
  const subOptions = [2, 3, 4, 8];
  const [localBpm, setLocalBpm] = React.useState(settings.bpm.toString());

  React.useEffect(() => {
    setLocalBpm(settings.bpm.toString());
  }, [settings.bpm]);

  const handleBpmChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setLocalBpm(val);
    
    const num = parseInt(val);
    if (!isNaN(num) && num >= 40 && num <= 300) {
      onUpdateBPM(num);
    }
  };

  const handleBpmBlur = () => {
    const num = parseInt(localBpm);
    if (isNaN(num) || num < 40) {
      onUpdateBPM(40);
      setLocalBpm('40');
    } else if (num > 300) {
      onUpdateBPM(300);
      setLocalBpm('300');
    } else {
      onUpdateBPM(num);
      setLocalBpm(num.toString());
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 bg-matte-gray/30 border-b border-white/5 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1" title="Індикатор долей такту">
          {Array.from({ length: settings.beats }).map((_, idx) => {
            const isCurrent = settings.metronome && activeBeat === idx;
            const isDownbeat = idx === 0;
            return (
              <div
                key={idx}
                className={`w-2 h-2 rounded-full transition-all duration-75 ${
                  isCurrent
                    ? isDownbeat
                      ? 'bg-orange-accent shadow-[0_0_10px_rgba(255,107,0,0.9)] scale-125'
                      : 'bg-amber-300 shadow-[0_0_8px_rgba(252,211,77,0.7)] scale-110'
                    : 'bg-white/10'
                }`}
              />
            );
          })}
        </div>
        <label className="text-[9px] uppercase tracking-widest text-gray-500 font-black">BPM</label>
        <input 
          type="number"
          value={localBpm}
          onChange={handleBpmChange}
          onBlur={handleBpmBlur}
          className="w-12 bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-xs font-mono text-orange-accent focus:outline-none focus:border-orange-accent/50"
          min={40}
          max={300}
        />
      </div>

      <div className="flex items-center gap-2">
        <label className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Beats</label>
        <div className="flex bg-black/40 rounded border border-white/10 p-0.5">
          {beatsOptions.map(b => (
            <button
              key={b}
              onClick={() => onUpdateBeats(b)}
              className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition-all ${settings.beats === b ? 'bg-orange-accent text-black' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <label className="text-[9px] uppercase tracking-widest text-gray-500 font-black">Delays</label>
        <div className="flex bg-black/40 rounded border border-white/10 p-0.5">
          {subOptions.map(s => (
            <button
              key={s}
              onClick={() => onUpdateSubdivisions(s)}
              className={`px-1.5 py-0.5 text-[9px] font-bold rounded transition-all ${settings.subdivisions === s ? 'bg-orange-accent text-black' : 'text-gray-500 hover:text-gray-300'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-4 ml-auto">
        <button 
          onClick={onToggleMetronome}
          className="flex items-center gap-1.5 group"
          title="Увімкнути/вимкнути звуковий метроном"
        >
          <div className={`w-6 h-3 rounded-full relative transition-colors ${settings.metronome ? 'bg-orange-accent' : 'bg-zinc-800'}`}>
            <div className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all ${settings.metronome ? 'left-3.5' : 'left-0.5'}`} />
          </div>
          <span className="text-[9px] uppercase tracking-widest text-gray-500 font-black group-hover:text-gray-300 transition-colors">Metro</span>
        </button>

        <button 
          onClick={onToggleMetrics}
          className="flex items-center gap-1.5 group"
        >
          <div className={`w-6 h-3 rounded-full relative transition-colors ${settings.showMetrics ? 'bg-orange-accent' : 'bg-zinc-800'}`}>
            <div className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all ${settings.showMetrics ? 'left-3.5' : 'left-0.5'}`} />
          </div>
          <span className="text-[9px] uppercase tracking-widest text-gray-500 font-black group-hover:text-gray-300 transition-colors">Metrics</span>
        </button>

        <button 
          onClick={onToggleStress}
          className="flex items-center gap-1.5 group"
        >
          <div className={`w-6 h-3 rounded-full relative transition-colors ${settings.showStressHighlight ? 'bg-orange-accent' : 'bg-zinc-800'}`}>
            <div className={`absolute top-0.5 w-2 h-2 rounded-full bg-white transition-all ${settings.showStressHighlight ? 'left-3.5' : 'left-0.5'}`} />
          </div>
          <span className="text-[9px] uppercase tracking-widest text-gray-500 font-black group-hover:text-gray-300 transition-colors">Accents</span>
        </button>
      </div>
    </div>
  );
};

export default SongSettings;


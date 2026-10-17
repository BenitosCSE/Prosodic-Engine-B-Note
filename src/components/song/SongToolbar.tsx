import React, { useState } from 'react';
import { Plus, LayoutList, Zap, ClipboardPaste, Check, Copy as CopyIcon } from 'lucide-react';

interface SongToolbarProps {
  onAddRow: () => void;
  onAddSection: () => void;
  onBakeAccents: () => void;
  onPasteAnalyze: () => void;
  onSave: () => void;
  onCopy: () => void;
  isSaved: boolean;
}

const SongToolbar: React.FC<SongToolbarProps> = ({ 
  onAddRow, onAddSection, onBakeAccents, onPasteAnalyze, onSave, onCopy, isSaved 
}) => {
  const [copied, setCopied] = useState(false);
  const [baked, setBaked] = useState(false);

  const handleCopyClick = () => {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  const handleBakeClick = () => {
    onBakeAccents();
    setBaked(true);
    setTimeout(() => setBaked(false), 1400);
  };

  return (
    <div className="flex items-center justify-start sm:justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 overflow-x-auto no-scrollbar">
      <button 
        onClick={onSave}
        disabled={isSaved}
        className={`shrink-0 flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 border rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
          isSaved 
            ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400/80 cursor-default' 
            : 'bg-orange-accent/20 border-orange-accent/50 text-orange-accent hover:bg-orange-accent/30 shadow-[0_0_15px_rgba(255,107,0,0.2)]'
        }`}
        title="Зберегти пісню"
      >
        {isSaved ? <Check size={12} className="text-emerald-400" /> : <Plus size={12} className="text-orange-accent" />}
        {isSaved ? 'Saved' : 'Save'}
      </button>

      <button 
        onClick={handleCopyClick}
        className={`shrink-0 flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 border rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
          copied
            ? 'bg-emerald-500/20 border-emerald-400/50 text-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.25)]'
            : 'bg-white/[0.04] hover:bg-white/[0.08] border-white/10 text-gray-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
        }`}
        title="Копіювати текст"
      >
        {copied ? <Check size={12} className="text-emerald-300" /> : <CopyIcon size={12} className="text-orange-accent" />}
        {copied ? 'Copied' : 'Copy'}
      </button>

      <div className="w-px h-4 bg-white/10 mx-0.5 sm:mx-1 shrink-0" />

      <button 
        onClick={onPasteAnalyze}
        className="shrink-0 flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 bg-orange-accent/10 hover:bg-orange-accent/20 border border-orange-accent/25 rounded-xl text-[10px] font-bold uppercase tracking-wider text-orange-accent transition-all active:scale-95 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] cursor-pointer"
        title="Вставити та розбити текст на рядки"
      >
        <ClipboardPaste size={12} />
        Analyze
      </button>

      <button 
        onClick={handleBakeClick}
        className={`shrink-0 flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 border rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all active:scale-95 cursor-pointer ${
          baked
            ? 'bg-amber-400/25 border-amber-300 text-amber-200 shadow-[0_0_20px_rgba(251,191,36,0.35)]'
            : 'bg-orange-accent/10 hover:bg-orange-accent/20 border-orange-accent/25 text-orange-accent shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]'
        }`}
        title="Зафіксувати словникові наголоси в тексті"
      >
        {baked ? <Check size={12} /> : <Zap size={12} fill="currentColor" />}
        {baked ? 'Baked!' : 'Bake'}
      </button>

      <div className="w-px h-4 bg-white/10 mx-0.5 sm:mx-1 shrink-0" />

      <button 
        onClick={onAddRow}
        className="shrink-0 flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-wider text-gray-300 transition-all active:scale-95 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] cursor-pointer"
      >
        <Plus size={12} className="text-orange-accent" />
        Row
      </button>
      
      <button 
        onClick={onAddSection}
        className="shrink-0 flex items-center gap-1.5 px-3 sm:px-3.5 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 rounded-xl text-[10px] font-bold uppercase tracking-wider text-gray-300 transition-all active:scale-95 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] cursor-pointer"
      >
        <LayoutList size={12} className="text-orange-accent" />
        Section
      </button>
    </div>
  );
};

export default SongToolbar;


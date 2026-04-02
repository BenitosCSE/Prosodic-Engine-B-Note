import React from 'react';
import { Plus, LayoutList, LayoutGrid, Zap } from 'lucide-react';

interface SongToolbarProps {
  onAddRow: () => void;
  onAddSection: () => void;
  onBakeAccents: () => void;
}

const SongToolbar: React.FC<SongToolbarProps> = ({ onAddRow, onAddSection, onBakeAccents }) => {
  return (
    <div className="flex items-center justify-center gap-4 p-6 bg-gradient-to-t from-matte-black to-transparent">
      <button 
        onClick={onBakeAccents}
        className="flex items-center gap-2 px-4 py-2 bg-orange-accent/10 hover:bg-orange-accent/20 border border-orange-accent/20 rounded-full text-xs font-bold uppercase tracking-widest text-orange-accent transition-all hover:scale-105 active:scale-95"
        title="Bake Accents (Insert Unicode stress marks based on dictionary)"
      >
        <Zap size={14} fill="currentColor" />
        Bake
      </button>

      <button 
        onClick={onAddRow}
        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-bold uppercase tracking-widest text-gray-300 transition-all hover:scale-105 active:scale-95"
      >
        <Plus size={14} className="text-orange-accent" />
        Row
      </button>
      
      <button 
        onClick={onAddSection}
        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-bold uppercase tracking-widest text-gray-300 transition-all hover:scale-105 active:scale-95"
      >
        <LayoutList size={14} className="text-orange-accent" />
        Section
      </button>
    </div>
  );
};

export default SongToolbar;

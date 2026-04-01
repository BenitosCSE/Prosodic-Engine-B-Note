import React from 'react';
import { Plus, LayoutList, LayoutGrid } from 'lucide-react';

interface SongToolbarProps {
  onAddRow: () => void;
  onAddSection: () => void;
  onAddBlock: () => void;
}

const SongToolbar: React.FC<SongToolbarProps> = ({ onAddRow, onAddSection, onAddBlock }) => {
  return (
    <div className="flex items-center justify-center gap-4 p-6 bg-gradient-to-t from-matte-black to-transparent">
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

      <button 
        onClick={onAddBlock}
        className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full text-xs font-bold uppercase tracking-widest text-gray-300 transition-all hover:scale-105 active:scale-95"
      >
        <LayoutGrid size={14} className="text-orange-accent" />
        Block
      </button>
    </div>
  );
};

export default SongToolbar;

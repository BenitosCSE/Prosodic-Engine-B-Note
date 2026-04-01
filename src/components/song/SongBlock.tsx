import React from 'react';
import { GripVertical, MoreVertical } from 'lucide-react';
import { Block, Row } from './types';
import { SongSettings } from '../../hooks/useSongSettings';
import SongRow from './SongRow';

interface SongBlockProps {
  block: Block;
  rows: Row[];
  settings: SongSettings;
  onUpdateRow: (id: string, text: string) => void;
  onDeleteRow: (id: string) => void;
  onDuplicateRow: (id: string) => void;
  onMoveRow: (id: string, direction: 'up' | 'down') => void;
  onConvertToSection: (id: string) => void;
  onUpdateBlockLabel: (id: string, label: string) => void;
  onDeleteBlock: (id: string) => void;
}

const SongBlock: React.FC<SongBlockProps> = ({
  block, rows, settings, onUpdateRow, onDeleteRow, onDuplicateRow, onMoveRow, onConvertToSection, onUpdateBlockLabel, onDeleteBlock
}) => {
  return (
    <div className="mb-8 border border-white/5 bg-white/[0.01] rounded-xl overflow-hidden shadow-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-white/[0.03] border-b border-white/5 group">
        <div className="flex items-center gap-2">
          <div className="text-gray-600 cursor-grab active:cursor-grabbing">
            <GripVertical size={16} />
          </div>
          <input 
            value={block.label}
            onChange={(e) => onUpdateBlockLabel(block.id, e.target.value)}
            className="bg-transparent text-gray-400 font-bold text-sm uppercase tracking-widest focus:outline-none"
            placeholder="Block Label..."
          />
        </div>
        
        <button 
          onClick={() => onDeleteBlock(block.id)}
          className="text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <MoreVertical size={16} />
        </button>
      </div>

      <div className="p-2 space-y-1">
        {rows.map(row => (
          <SongRow 
            key={row.id}
            row={row}
            settings={settings}
            onUpdate={onUpdateRow}
            onDelete={onDeleteRow}
            onDuplicate={onDuplicateRow}
            onMove={onMoveRow}
            onConvertToSection={onConvertToSection}
          />
        ))}
        {rows.length === 0 && (
          <div className="py-8 text-center text-gray-600 text-sm italic">
            No rows in this block
          </div>
        )}
      </div>
    </div>
  );
};

export default SongBlock;

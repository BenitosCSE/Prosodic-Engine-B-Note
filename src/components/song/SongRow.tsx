import React, { useRef, useEffect } from 'react';
import { MoreVertical, Trash2, Copy, ArrowUp, ArrowDown, LayoutList } from 'lucide-react';
import { Row } from './types';
import { SongSettings } from '../../hooks/useSongSettings';
import { useProsody } from '../../hooks/useProsody';
import MetricsRow from './MetricsRow';
import StressOverlay from './StressOverlay';

interface SongRowProps {
  row: Row;
  settings: SongSettings;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onConvertToSection: (id: string) => void;
}

const SongRow: React.FC<SongRowProps> = ({ 
  row, settings, onUpdate, onDelete, onDuplicate, onMove, onConvertToSection 
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { metrics } = useProsody(row.text, settings);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [row.text]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const cursor = e.target.selectionStart;

    // Shortcut logic: letter + . + space + space
    if (cursor >= 4) {
      const last4 = val.substring(cursor - 4, cursor);
      // Regex checks for a letter followed by a dot and two spaces
      if (/[a-zA-Zа-яА-ЯіїєґІЇЄҐ]\.  /.test(last4)) {
        // Replace '.  ' with the stress mark '\u0301'
        const newVal = val.substring(0, cursor - 3) + '\u0301' + val.substring(cursor);
        onUpdate(row.id, newVal);
        
        // Need to restore cursor position after the replacement
        setTimeout(() => {
          const textarea = e.target;
          const newPos = cursor - 2; // Move back because we removed 3 chars and added 1
          textarea.setSelectionRange(newPos, newPos);
        }, 0);
        return;
      }
    }

    onUpdate(row.id, val);
  };

  if (row.isSection) {
    return (
      <div className="group relative py-4 px-2 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="h-px flex-grow bg-orange-accent/20" />
          <input 
            value={row.text}
            onChange={(e) => onUpdate(row.id, e.target.value)}
            className="bg-transparent text-orange-accent font-bold uppercase tracking-[0.2em] text-center focus:outline-none min-w-[120px]"
            placeholder="[SECTION]"
          />
          <div className="h-px flex-grow bg-orange-accent/20" />
        </div>
        
        <div className="absolute right-0 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
          <button onClick={() => onMove(row.id, 'up')} className="p-1.5 text-gray-500 hover:text-white"><ArrowUp size={14} /></button>
          <button onClick={() => onMove(row.id, 'down')} className="p-1.5 text-gray-500 hover:text-white"><ArrowDown size={14} /></button>
          <button onClick={() => onDelete(row.id)} className="p-1.5 text-gray-500 hover:text-red-400"><Trash2 size={14} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="group relative py-3 px-2 hover:bg-white/[0.02] transition-colors rounded-lg">
      <div className="relative">
        {settings.showStressHighlight && <StressOverlay metrics={metrics} text={row.text} />}
        <textarea
          ref={textareaRef}
          value={row.text}
          onChange={handleInput}
          placeholder="Рядок..."
          rows={1}
          className={`w-full bg-transparent p-4 text-lg leading-relaxed outline-none resize-none overflow-hidden placeholder:text-gray-700 ${settings.showStressHighlight ? 'text-white/40 caret-orange-accent' : 'text-gray-200'}`}
          spellCheck={false}
        />
      </div>

      {settings.showMetrics && metrics && (
        <div className="px-4 pb-1">
          <MetricsRow metrics={metrics} bpm={settings.bpm} />
        </div>
      )}

      <div className="absolute -right-2 top-4 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 z-10 bg-matte-gray/80 backdrop-blur rounded-lg border border-white/5 p-1 shadow-xl">
        <button onClick={() => onMove(row.id, 'up')} className="p-1.5 text-gray-500 hover:text-white" title="Move Up"><ArrowUp size={16} /></button>
        <button onClick={() => onMove(row.id, 'down')} className="p-1.5 text-gray-500 hover:text-white" title="Move Down"><ArrowDown size={16} /></button>
        <button onClick={() => onDuplicate(row.id)} className="p-1.5 text-gray-500 hover:text-white" title="Duplicate"><Copy size={16} /></button>
        <button onClick={() => onConvertToSection(row.id)} className="p-1.5 text-gray-500 hover:text-orange-accent" title="To Section"><LayoutList size={16} /></button>
        <button onClick={() => onDelete(row.id)} className="p-1.5 text-gray-500 hover:text-red-400" title="Delete"><Trash2 size={16} /></button>
      </div>
    </div>
  );
};

export default SongRow;

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Settings, Trash2, Download, Copy, Check } from 'lucide-react';
import { Note } from '../../db';
import { useSongSettings } from '../../hooks/useSongSettings';
import { SongContent, Row, Block } from './types';
import { VOWELS } from '../../utils/prosodyEngine';
import SongSettingsPanel from './SongSettings';
import SongToolbar from './SongToolbar';
import SongBlock from './SongBlock';
import SongRow from './SongRow';

interface SongEditorProps {
  note: Note | null;
  onSave: (noteData: Partial<Note>) => void;
  onClose: () => void;
  onDelete: (id: number) => void;
}

const SongEditor: React.FC<SongEditorProps> = ({ note, onSave, onClose, onDelete }) => {
  const { settings, updateBPM, updateBeats, toggleMetrics, toggleStress, updateDictionary } = useSongSettings();
  const [title, setTitle] = useState(note?.title || 'Untitled Song');
  const [rows, setRows] = useState<Row[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize data
  useEffect(() => {
    if (note?.content) {
      try {
        const content: SongContent = JSON.parse(note.content);
        setRows(content.rows || []);
        setBlocks(content.blocks || []);
        if (content.dictionary) {
          updateDictionary({ ...settings.customDictionary, ...content.dictionary });
        }
      } catch (e) {
        console.error('Failed to parse song content', e);
        setRows([{ id: '1', text: '', isSection: false, blockId: null }]);
      }
    } else {
      setRows([{ id: '1', text: '', isSection: false, blockId: null }]);
    }
  }, [note]);

  const extractStressedWords = useCallback((rows: Row[]) => {
    const learned: Record<string, number> = {};
    rows.forEach(row => {
      // Split by non-word characters but keep the stress mark \u0301
      const words = row.text.split(/[^a-zA-Zа-яА-ЯіїєґІЇЄҐ\u0301]+/);
      words.forEach(word => {
        if (word.includes('\u0301')) {
          const cleanWord = word.replace(/\u0301/g, '').toLowerCase();
          if (cleanWord.length < 2) return;

          // Find vowel index
          const wordLower = word.toLowerCase();
          let vowelCount = 0;
          let stressIdx = -1;
          
          for (let i = 0; i < wordLower.length; i++) {
            const char = wordLower[i];
            if (VOWELS.has(char)) {
              if (wordLower[i+1] === '\u0301') {
                stressIdx = vowelCount;
              }
              vowelCount++;
            }
          }
          
          if (stressIdx !== -1) {
            learned[cleanWord] = stressIdx;
          }
        }
      });
    });
    return learned;
  }, []);

  const triggerSave = useCallback(() => {
    setIsSaved(false);
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    saveTimeoutRef.current = setTimeout(() => {
      const learnedDict = extractStressedWords(rows);
      const finalDict = { ...settings.customDictionary, ...learnedDict };
      
      const content: SongContent = {
        settings: { ...settings, customDictionary: finalDict },
        blocks,
        rows,
        dictionary: finalDict
      };
      
      onSave({
        id: note?.id,
        title,
        content: JSON.stringify(content),
        plainText: rows.map(r => r.text).join('\n'),
        type: 'song',
        createdAt: note?.createdAt,
      });
      setIsSaved(true);
    }, 1000);
  }, [note, title, rows, blocks, settings, onSave, extractStressedWords]);

  useEffect(() => {
    if (rows.length > 0 || title !== (note?.title || 'Untitled Song')) {
      triggerSave();
    }
    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [rows, blocks, title, settings, triggerSave]);

  const handleAddRow = () => {
    const newRow: Row = { id: Date.now().toString(), text: '', isSection: false, blockId: null };
    setRows([...rows, newRow]);
  };

  const handleAddSection = () => {
    const newRow: Row = { id: Date.now().toString(), text: '[SECTION]', isSection: true, blockId: null };
    setRows([...rows, newRow]);
  };

  const handleAddBlock = () => {
    const label = prompt('Enter block label (e.g. Verse 1):');
    if (label) {
      const newBlock: Block = { id: Date.now().toString(), label, order: blocks.length };
      setBlocks([...blocks, newBlock]);
    }
  };

  const handleUpdateRow = (id: string, text: string) => {
    setRows(rows.map(r => r.id === id ? { ...r, text } : r));
  };

  const handleDeleteRow = (id: string) => {
    setRows(rows.filter(r => r.id !== id));
  };

  const handleDuplicateRow = (id: string) => {
    const index = rows.findIndex(r => r.id === id);
    if (index !== -1) {
      const newRow = { ...rows[index], id: Date.now().toString() };
      const newRows = [...rows];
      newRows.splice(index + 1, 0, newRow);
      setRows(newRows);
    }
  };

  const handleMoveRow = (id: string, direction: 'up' | 'down') => {
    const index = rows.findIndex(r => r.id === id);
    if (index === -1) return;
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === rows.length - 1) return;

    const newRows = [...rows];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newRows[index], newRows[targetIndex]] = [newRows[targetIndex], newRows[index]];
    setRows(newRows);
  };

  const handleConvertToSection = (id: string) => {
    setRows(rows.map(r => r.id === id ? { ...r, isSection: !r.isSection, text: r.isSection ? r.text.replace(/[\[\]]/g, '') : `[${r.text || 'SECTION'}]` } : r));
  };

  const handleUpdateBlockLabel = (id: string, label: string) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, label } : b));
  };

  const handleDeleteBlock = (id: string) => {
    if (confirm('Delete block? Rows will be kept but unassigned.')) {
      setBlocks(blocks.filter(b => b.id !== id));
      setRows(rows.map(r => r.blockId === id ? { ...r, blockId: null } : r));
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    // Optional: implement smart paste logic
  };

  return (
    <div className="flex flex-col h-full bg-matte-black text-gray-200 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-matte-gray/50 backdrop-blur-xl z-20">
        <div className="flex items-center gap-4 flex-grow">
          <button onClick={onClose} className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </button>
          <input 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-transparent text-xl font-bold focus:outline-none w-full orange-text-gradient"
            placeholder="Song Title..."
          />
        </div>
        
        <div className="flex items-center gap-2">
          <div className="text-[10px] uppercase tracking-widest font-black text-gray-600 mr-2">
            {isSaved ? <span className="flex items-center gap-1 text-emerald-500/60"><Check size={12} /> Saved</span> : <span className="animate-pulse">Saving...</span>}
          </div>
          <button 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`p-2 rounded-lg transition-all ${isSettingsOpen ? 'bg-orange-accent text-black' : 'text-gray-400 hover:bg-white/5'}`}
          >
            <Settings size={20} />
          </button>
          {note?.id && (
            <button 
              onClick={() => confirm('Delete this song?') && onDelete(note.id!)}
              className="p-2 text-gray-500 hover:text-red-400 transition-colors"
            >
              <Trash2 size={20} />
            </button>
          )}
        </div>
      </header>

      {/* Settings Panel */}
      {isSettingsOpen && (
        <SongSettingsPanel 
          settings={settings}
          onUpdateBPM={updateBPM}
          onUpdateBeats={updateBeats}
          onToggleMetrics={toggleMetrics}
          onToggleStress={toggleStress}
        />
      )}

      {/* Content */}
      <div className="flex-grow overflow-y-auto p-6 space-y-2 no-scrollbar" onPaste={handlePaste}>
        {/* Render Blocks */}
        {blocks.sort((a, b) => a.order - b.order).map(block => (
          <SongBlock 
            key={block.id}
            block={block}
            rows={rows.filter(r => r.blockId === block.id)}
            settings={settings}
            onUpdateRow={handleUpdateRow}
            onDeleteRow={handleDeleteRow}
            onDuplicateRow={handleDuplicateRow}
            onMoveRow={handleMoveRow}
            onConvertToSection={handleConvertToSection}
            onUpdateBlockLabel={handleUpdateBlockLabel}
            onDeleteBlock={handleDeleteBlock}
          />
        ))}

        {/* Render Unassigned Rows */}
        <div className="space-y-1">
          {rows.filter(r => !r.blockId).map(row => (
            <SongRow 
              key={row.id}
              row={row}
              settings={settings}
              onUpdate={handleUpdateRow}
              onDelete={handleDeleteRow}
              onDuplicate={handleDuplicateRow}
              onMove={handleMoveRow}
              onConvertToSection={handleConvertToSection}
            />
          ))}
        </div>

        {rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-600 italic">
            <p className="mb-4">Empty song. Start by adding a row.</p>
          </div>
        )}
        
        <div className="h-32" /> {/* Bottom spacer */}
      </div>

      {/* Toolbar */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-[860px] z-30">
        <SongToolbar 
          onAddRow={handleAddRow}
          onAddSection={handleAddSection}
          onAddBlock={handleAddBlock}
        />
      </div>
    </div>
  );
};

export default SongEditor;

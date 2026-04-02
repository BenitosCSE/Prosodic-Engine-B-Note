import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Settings, Trash2, Download, Copy, Check } from 'lucide-react';
import { Note } from '../../db';
import { useSongSettings } from '../../hooks/useSongSettings';
import { SongContent, Row } from './types';
import { VOWELS, applyAccentsToText } from '../../utils/prosodyEngine';
import SongSettingsPanel from './SongSettings';
import SongToolbar from './SongToolbar';
import SongRow from './SongRow';

interface SongEditorProps {
  note: Note | null;
  onSave: (noteData: Partial<Note>) => Promise<number>;
  onClose: () => void;
  onDelete: (id: number) => void;
}

const SongEditor: React.FC<SongEditorProps> = ({ note, onSave, onClose, onDelete }) => {
  const { settings, updateBPM, updateBeats, toggleMetrics, toggleStress, updateDictionary } = useSongSettings();
  const [title, setTitle] = useState(note?.title || 'Untitled Song');
  const [rows, setRows] = useState<Row[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const [currentId, setCurrentId] = useState<number | undefined>(note?.id);

  // Initialize data
  useEffect(() => {
    if (note?.content) {
      try {
        const content: SongContent = JSON.parse(note.content);
        setRows(content.rows || []);
        setCurrentId(note.id);
        if (content.dictionary) {
          updateDictionary({ ...settings.customDictionary, ...content.dictionary });
        }
      } catch (e) {
        console.error('Failed to parse song content', e);
        setRows([{ id: '1', text: '', isSection: false }]);
      }
    } else {
      setRows([{ id: '1', text: '', isSection: false }]);
      setCurrentId(undefined);
    }
  }, [note]);

  const extractStressedWords = useCallback((rows: Row[]) => {
    const learned: Record<string, number> = {};
    rows.forEach(row => {
      const words = row.text.split(/[^a-zA-Zа-яА-ЯіїєґІЇЄҐ\u0301]+/);
      words.forEach(word => {
        if (word.includes('\u0301')) {
          const cleanWord = word.replace(/\u0301/g, '').toLowerCase();
          if (cleanWord.length < 2) return;

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

  const performSave = useCallback(async () => {
    const learnedDict = extractStressedWords(rows);
    const finalDict = { ...settings.customDictionary, ...learnedDict };
    
    const content: SongContent = {
      settings: { ...settings, customDictionary: finalDict },
      rows,
      dictionary: finalDict
    };
    
    const id = await onSave({
      id: currentId,
      title,
      content: JSON.stringify(content),
      plainText: rows.map(r => r.text).join('\n'),
      type: 'song',
      createdAt: note?.createdAt,
    });
    
    if (!currentId) {
      setCurrentId(id);
    }
    setIsSaved(true);
  }, [note, title, rows, settings, onSave, extractStressedWords, currentId]);

  const handleClose = async () => {
    if (!isSaved) {
      await performSave();
    }
    onClose();
  };

  useEffect(() => {
    // Mark as unsaved when content changes
    if (rows.length > 0 || title !== (note?.title || 'Untitled Song')) {
      setIsSaved(false);
      
      // Live extract dictionary so other words update immediately
      const liveDict = extractStressedWords(rows);
      updateDictionary({ ...settings.customDictionary, ...liveDict });
    }
  }, [rows, title]);

  const handleAddRow = () => {
    const newRow: Row = { id: Date.now().toString(), text: '', isSection: false };
    setRows([...rows, newRow]);
  };

  const handleAddSection = () => {
    const newRow: Row = { id: Date.now().toString(), text: '[SECTION]', isSection: true };
    setRows([...rows, newRow]);
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

  const handleBakeAccents = () => {
    const newRows = rows.map(row => {
      if (row.isSection) return row;
      return {
        ...row,
        text: applyAccentsToText(row.text, settings.customDictionary)
      };
    });
    setRows(newRows);
    setIsSaved(false);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    // Optional: implement smart paste logic
  };

  return (
    <div className="flex flex-col h-full bg-matte-black text-gray-200 overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-matte-gray/50 backdrop-blur-xl z-20">
        <div className="flex items-center gap-4 flex-grow">
          <button onClick={handleClose} className="p-2 -ml-2 text-gray-400 hover:text-white transition-colors">
            <ArrowLeft size={24} />
          </button>
          <input 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-transparent text-xl font-bold focus:outline-none w-full orange-text-gradient"
            placeholder="Назва пісні..."
          />
        </div>
        
        <div className="flex items-center gap-3">
          {/* Static Unsaved Indicator */}
          {!isSaved && (
            <div className="w-2 h-2 rounded-full bg-orange-accent shadow-[0_0_10px_rgba(255,107,0,0.5)]" title="Є незбережені зміни" />
          )}
          
          <button 
            onClick={performSave}
            className={`p-2 rounded-full transition-all ${
              isSaved 
                ? 'text-gray-600 cursor-default' 
                : 'text-orange-accent hover:bg-orange-accent/10 active:scale-90'
            }`}
            disabled={isSaved}
            title="Зберегти"
          >
            <Download size={22} />
          </button>

          <button 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`p-2 rounded-full transition-all ${isSettingsOpen ? 'bg-orange-accent text-black' : 'text-gray-400 hover:bg-white/5'}`}
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
      <div className="flex-grow overflow-y-auto p-2 sm:p-6 space-y-1 no-scrollbar" onPaste={handlePaste}>
        <div className="max-w-[800px] mx-auto space-y-1">
          {rows.map(row => (
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
          onBakeAccents={handleBakeAccents}
        />
      </div>
    </div>
  );
};

export default SongEditor;

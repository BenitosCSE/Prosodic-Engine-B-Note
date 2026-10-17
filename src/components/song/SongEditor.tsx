import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { 
  DndContext, 
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  TouchSensor
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { ArrowLeft, Settings, Trash2, Save, Copy, Check, Tag, Download, Volume2, VolumeX } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Note, Group } from '../../db';
import { useSongSettings } from '../../hooks/useSongSettings';
import { useMetronome } from '../../hooks/useMetronome';
import { SongContent, Row } from './types';
import { VOWELS, applyAccentsToText, analyzeText, compareRhymeSignatures } from '../../utils/prosodyEngine';
import SongSettingsPanel from './SongSettings';
import SongToolbar from './SongToolbar';
import SongRow, { SectionDeltaSummary } from './SongRow';
import { RhymeGroupBadge } from './MetricsRow';

interface SongEditorProps {
  note: Note | null;
  groups: Group[];
  onSave: (noteData: Partial<Note>) => Promise<number>;
  onClose: () => void;
  onDelete: (id: number) => void;
}

const RHYME_PALETTE = [
  'border-emerald-400/70 bg-emerald-500/15 text-emerald-300',
  'border-cyan-400/70 bg-cyan-500/15 text-cyan-300',
  'border-amber-400/70 bg-amber-500/15 text-amber-300',
  'border-violet-400/70 bg-violet-500/15 text-violet-300',
  'border-rose-400/70 bg-rose-500/15 text-rose-300',
  'border-sky-400/70 bg-sky-500/15 text-sky-300',
];

const RHYME_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

const SortableRow = ({ id, children }: { id: string, children: React.ReactNode }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 100 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {React.Children.map(children, child => {
        if (React.isValidElement(child)) {
          return React.cloneElement(child as React.ReactElement<any>, {
            dragHandleProps: { ...attributes, ...listeners }
          });
        }
        return child;
      })}
    </div>
  );
};

const SongEditor: React.FC<SongEditorProps> = ({ note, groups, onSave, onClose, onDelete }) => {
  const { 
    settings, updateBPM, updateBeats, updateSubdivisions, 
    toggleMetrics, toggleStress, toggleMetronome, updateDictionary 
  } = useSongSettings();

  const { activeBeat } = useMetronome(settings.bpm, settings.beats, settings.subdivisions, settings.metronome);

  const [title, setTitle] = useState(note?.title || 'Untitled Song');
  const [rows, setRows] = useState<Row[]>([]);
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSaved, setIsSaved] = useState(true);
  const [currentId, setCurrentId] = useState<number | undefined>(note?.id);
  const [selectedGroupId, setSelectedGroupId] = useState<number | undefined>(note?.groupId);
  const [showGroupPicker, setShowGroupPicker] = useState(false);
  const [isAnalyzeModalOpen, setIsAnalyzeModalOpen] = useState(false);
  const [analyzeTextValue, setAnalyzeTextValue] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setRows((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
      setIsSaved(false);
    }
  };

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
      const words = row.text.split(/[^a-zA-Zа-яА-ЯіїєґІЇЄҐ\u0301'’ʼ‘`]+/);
      words.forEach(word => {
        if (word.includes('\u0301')) {
          const cleanWord = word.replace(/\u0301/g, '').replace(/[’ʼ‘`]/g, "'").toLowerCase();
          if (cleanWord.length < 2) return;

          const wordLower = word.toLowerCase();
          let vowelCount = 0;
          let stressIdx = -1;
          
          for (let i = 0; i < wordLower.length; i++) {
            const char = wordLower[i];
            if (VOWELS.has(char)) {
              if (wordLower[i + 1] === '\u0301') {
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

  // Compute cross-row Rhyme Link groups and Section Delta summaries per section block
  const { rhymeGroupsByRowId, sectionSummariesByRowId } = useMemo(() => {
    const rhymeMap: Record<string, RhymeGroupBadge> = {};
    const sectionMap: Record<string, SectionDeltaSummary> = {};

    // Split rows into sections
    interface Block {
      sectionRowId: string | null;
      lyricRows: { id: string; metrics: ReturnType<typeof analyzeText> }[];
    }

    const blocks: Block[] = [{ sectionRowId: null, lyricRows: [] }];

    rows.forEach(r => {
      if (r.isSection) {
        blocks.push({ sectionRowId: r.id, lyricRows: [] });
      } else if (r.text.trim()) {
        const m = analyzeText(
          r.text,
          settings.bpm,
          settings.beats,
          settings.customDictionary,
          settings.subdivisions
        );
        if (m.S > 0) {
          blocks[blocks.length - 1].lyricRows.push({ id: r.id, metrics: m });
        }
      }
    });

    blocks.forEach(block => {
      const { sectionRowId, lyricRows } = block;

      // 1. Section Delta Summary
      if (sectionRowId && lyricRows.length > 0) {
        const sylCounts = lyricRows.map(lr => lr.metrics.S);
        const syllablePattern =
          sylCounts.length <= 6
            ? sylCounts.join('-')
            : `${sylCounts.slice(0, 4).join('-')}…`;

        const meterFreq: Record<string, number> = {};
        let totalSingability = 0;
        let minBpmMax = Infinity;

        lyricRows.forEach(lr => {
          const mName = lr.metrics.meterName;
          if (mName && mName !== '—') {
            meterFreq[mName] = (meterFreq[mName] || 0) + 1;
          }
          totalSingability += lr.metrics.singability;
          if (lr.metrics.BPMmax > 0 && lr.metrics.BPMmax < minBpmMax) {
            minBpmMax = lr.metrics.BPMmax;
          }
        });

        const dominantMeter =
          Object.entries(meterFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

        sectionMap[sectionRowId] = {
          lineCount: lyricRows.length,
          syllablePattern,
          dominantMeter,
          avgSingability: Math.round(totalSingability / lyricRows.length),
          minBpmMax: minBpmMax === Infinity ? 0 : Math.round(minBpmMax),
        };
      }

      // 2. Cross-row Rhyme Link Detection within this section
      let groupIndex = 0;
      const assigned = new Map<number, { groupIdx: number; matchType: 'exact' | 'assonance' }>();

      for (let i = 0; i < lyricRows.length; i++) {
        const sigA = lyricRows[i].metrics.rhymeSignature;
        if (!sigA) continue;

        // Look ahead up to 4 lines in the same section for rhyming partners
        for (let j = i + 1; j < Math.min(lyricRows.length, i + 5); j++) {
          const sigB = lyricRows[j].metrics.rhymeSignature;
          if (!sigB) continue;

          const match = compareRhymeSignatures(sigA, sigB);
          if (match) {
            const existingGroup = assigned.get(i)?.groupIdx ?? assigned.get(j)?.groupIdx;
            const gIdx = existingGroup !== undefined ? existingGroup : groupIndex++;

            const prevI = assigned.get(i);
            if (!prevI || match === 'exact') {
              assigned.set(i, { groupIdx: gIdx, matchType: match });
            }
            const prevJ = assigned.get(j);
            if (!prevJ || match === 'exact') {
              assigned.set(j, { groupIdx: gIdx, matchType: match });
            }
          }
        }
      }

      assigned.forEach((val, rowIdx) => {
        const rowId = lyricRows[rowIdx].id;
        const label = RHYME_LABELS[val.groupIdx % RHYME_LABELS.length];
        const colorClass = RHYME_PALETTE[val.groupIdx % RHYME_PALETTE.length];
        rhymeMap[rowId] = {
          label,
          colorClass,
          matchType: val.matchType,
        };
      });
    });

    return { rhymeGroupsByRowId: rhymeMap, sectionSummariesByRowId: sectionMap };
  }, [rows, settings.bpm, settings.beats, settings.customDictionary, settings.subdivisions]);

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
      groupId: selectedGroupId,
      createdAt: note?.createdAt,
    });
    
    if (!currentId) {
      setCurrentId(id);
    }
    setIsSaved(true);
  }, [note, title, rows, settings, onSave, extractStressedWords, currentId, selectedGroupId]);

  const handleClose = async () => {
    if (!isSaved) {
      await performSave();
    }
    onClose();
  };

  useEffect(() => {
    if (rows.length > 0 || title !== (note?.title || 'Untitled Song')) {
      setIsSaved(false);
      
      const liveDict = extractStressedWords(rows);
      const hasChanges = Object.entries(liveDict).some(
        ([word, idx]) => settings.customDictionary[word] !== idx
      );
      if (hasChanges) {
        updateDictionary({ ...settings.customDictionary, ...liveDict });
      }
    }
  }, [rows, title, extractStressedWords, settings.customDictionary, updateDictionary, note?.title]);

  const handleAddRow = () => {
    const newId = Date.now().toString();
    const newRow: Row = { id: newId, text: '', isSection: false };
    setRows(prev => [...prev, newRow]);
    setAutoFocusId(newId);
  };

  const handleAddSection = () => {
    const newId = Date.now().toString();
    const newRow: Row = { id: newId, text: '[Куплет]', isSection: true };
    setRows(prev => [...prev, newRow]);
    setAutoFocusId(newId);
  };

  const handleEnterRow = (id: string, textAfterCursor: string, textBeforeCursor: string) => {
    const index = rows.findIndex(r => r.id === id);
    if (index === -1) return;

    const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const updatedCurrent: Row = { ...rows[index], text: textBeforeCursor };
    const insertedRow: Row = {
      id: newId,
      text: textAfterCursor,
      isSection: false
    };

    const nextRows = [...rows];
    nextRows[index] = updatedCurrent;
    nextRows.splice(index + 1, 0, insertedRow);
    setRows(nextRows);
    setAutoFocusId(newId);
  };

  const handleBackspaceEmpty = (id: string) => {
    if (rows.length <= 1) return;
    const index = rows.findIndex(r => r.id === id);
    if (index === -1) return;

    const prevId = index > 0 ? rows[index - 1].id : rows[index + 1]?.id ?? null;
    setRows(rows.filter(r => r.id !== id));
    if (prevId) {
      setAutoFocusId(prevId);
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
    setAutoFocusId(id);
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

  const [copiedHeader, setCopiedHeader] = useState(false);

  const handleCopy = () => {
    const fullText = rows.map(r => r.text).join('\n');
    navigator.clipboard.writeText(fullText);
    setCopiedHeader(true);
    setTimeout(() => setCopiedHeader(false), 1600);
  };

  const handleExport = () => {
    const fullText = rows.map(r => r.text).join('\n');
    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'song'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT' || (e.target as HTMLElement).tagName === 'TEXTAREA') {
      return;
    }

    e.preventDefault();
    const text = e.clipboardData.getData('text');
    if (!text) return;

    const lines = text.split(/\r?\n/);
    const newRows: Row[] = lines
      .filter(line => line.trim() !== '')
      .map(line => {
        const trimmed = line.trim();
        const isSection = trimmed.startsWith('[') && trimmed.endsWith(']');
        return {
          id: Math.random().toString(36).substring(2, 11),
          text: trimmed,
          isSection
        };
      });

    if (newRows.length > 0) {
      if (rows.length === 1 && rows[0].text === '') {
        setRows(newRows);
      } else {
        setRows([...rows, ...newRows]);
      }
      setIsSaved(false);
    }
  };

  const handlePasteAnalyze = () => {
    setAnalyzeTextValue('');
    setIsAnalyzeModalOpen(true);
  };

  const performAnalysis = () => {
    if (!analyzeTextValue.trim()) return;
    
    const lines = analyzeTextValue.split(/\r?\n/);
    const newRows: Row[] = lines
      .filter(line => line.trim() !== '')
      .map(line => {
        const trimmed = line.trim();
        const isSection = trimmed.startsWith('[') && trimmed.endsWith(']');
        return {
          id: Math.random().toString(36).substring(2, 11),
          text: trimmed,
          isSection
        };
      });

    if (newRows.length > 0) {
      if (rows.length <= 1 && (rows[0]?.text === '' || rows.length === 0)) {
        setRows(newRows);
      } else {
        setRows([...rows, ...newRows]);
      }
      setIsSaved(false);
    }
    setIsAnalyzeModalOpen(false);
    setAnalyzeTextValue('');
  };

  return (
    <div className="fixed inset-0 h-[100dvh] z-[9999] flex flex-col bg-matte-black text-gray-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
      {/* Header with subtle downbeat studio glow */}
      <header
        className={`flex-shrink-0 flex items-center justify-between gap-2 px-3 sm:px-6 py-3 sm:py-4 pt-safe border-b bg-matte-gray/95 backdrop-blur-xl z-50 transition-all duration-100 ${
          settings.metronome && activeBeat === 0
            ? 'border-orange-accent/40 shadow-[0_6px_30px_rgba(255,107,0,0.12)]'
            : 'border-white/5'
        }`}
      >
        <div className="flex items-center gap-2 sm:gap-4 flex-grow min-w-0">
          <button onClick={handleClose} className="p-1.5 sm:p-2 -ml-1 sm:-ml-2 text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0">
            <ArrowLeft size={22} />
          </button>
          <input 
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="bg-transparent text-base sm:text-xl font-bold focus:outline-none w-full min-w-[90px] orange-text-gradient truncate"
            placeholder="Назва пісні..."
          />
        </div>
        
        <div className="flex items-center gap-1 sm:gap-2.5 shrink-0">
          {/* Quick Web Audio Metronome Pill in Header */}
          <button
            onClick={toggleMetronome}
            className={`flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-full border text-[11px] sm:text-xs font-mono font-bold transition-all cursor-pointer ${
              settings.metronome
                ? 'bg-orange-accent/20 border-orange-accent/50 text-orange-accent shadow-[0_0_12px_rgba(255,107,0,0.25)]'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
            }`}
            title="Увімкнути/вимкнути звуковий метроном"
          >
            <span
              className={`w-2 h-2 rounded-full transition-transform duration-75 ${
                settings.metronome && activeBeat >= 0
                  ? activeBeat === 0
                    ? 'bg-orange-accent scale-125 shadow-[0_0_8px_rgba(255,107,0,1)]'
                    : 'bg-amber-300 scale-110'
                  : 'bg-gray-600'
              }`}
            />
            <span>{settings.bpm}</span>
            {settings.metronome ? <Volume2 size={13} /> : <VolumeX size={13} />}
          </button>

          {/* Static Unsaved Indicator */}
          {!isSaved && (
            <div className="w-2 h-2 rounded-full bg-orange-accent shadow-[0_0_10px_rgba(255,107,0,0.5)] shrink-0" title="Є незбережені зміни" />
          )}
          
          <button 
            onClick={performSave}
            className={`hidden sm:inline-flex p-2 rounded-full transition-all cursor-pointer ${
              isSaved 
                ? 'text-emerald-400/70 cursor-default' 
                : 'text-orange-accent hover:bg-orange-accent/10 active:scale-90'
            }`}
            disabled={isSaved}
            title={isSaved ? 'Збережено' : 'Зберегти'}
          >
            {isSaved ? <Check size={20} /> : <Save size={22} />}
          </button>

          <button 
            onClick={handleCopy}
            className={`hidden sm:inline-flex p-2 rounded-full transition-all cursor-pointer ${
              copiedHeader
                ? 'text-emerald-300 bg-emerald-500/15'
                : 'text-gray-400 hover:text-white hover:bg-white/5'
            }`}
            title="Копіювати текст"
          >
            {copiedHeader ? <Check size={20} /> : <Copy size={20} />}
          </button>

          <button 
            onClick={handleExport}
            className="p-1.5 sm:p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-all cursor-pointer"
            title="Експортувати (.txt)"
          >
            <Download size={19} />
          </button>

          {/* Group Picker */}
          <div className="relative">
            <button 
              onClick={() => setShowGroupPicker(!showGroupPicker)}
              className={`p-1.5 sm:p-2 rounded-full transition-all cursor-pointer ${selectedGroupId ? 'text-orange-accent bg-orange-accent/10' : 'text-gray-400 hover:bg-white/5'}`}
              title="Вибрати групу"
            >
              <Tag size={19} />
            </button>

            {showGroupPicker && (
              <div className="absolute top-full right-0 mt-2 w-48 matte-card z-50 shadow-2xl border-orange-accent/20 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <button 
                  onClick={() => { setSelectedGroupId(undefined); setShowGroupPicker(false); setIsSaved(false); }}
                  className="w-full p-3 text-left hover:bg-white/5 text-sm border-b border-white/5"
                >
                  No Group
                </button>
                {groups.map(group => (
                  <button
                    key={group.id}
                    onClick={() => { setSelectedGroupId(group.id); setShowGroupPicker(false); setIsSaved(false); }}
                    className={`w-full p-3 text-left hover:bg-white/5 text-sm flex items-center gap-2 ${selectedGroupId === group.id ? 'text-orange-accent' : 'text-gray-300'}`}
                  >
                    <Tag size={14} />
                    {group.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button 
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`p-1.5 sm:p-2 rounded-full transition-all cursor-pointer ${isSettingsOpen ? 'bg-orange-accent text-black shadow-[0_0_15px_rgba(255,107,0,0.4)]' : 'text-gray-400 hover:bg-white/5'}`}
            title="Налаштування ритму та метрики"
          >
            <Settings size={19} />
          </button>
          {note?.id && (
            <button 
              onClick={() => confirm('Delete this song?') && onDelete(note.id!)}
              className="p-1.5 sm:p-2 text-gray-500 hover:text-red-400 transition-colors cursor-pointer"
              title="Видалити пісню"
            >
              <Trash2 size={19} />
            </button>
          )}
        </div>
      </header>

      {/* Tools Area */}
      <div className="flex-shrink-0 z-40">
        {/* Settings Panel with spring expand/collapse */}
        <AnimatePresence>
          {isSettingsOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', stiffness: 400, damping: 32 }}
              className="overflow-hidden"
            >
              <SongSettingsPanel 
                settings={settings}
                activeBeat={activeBeat}
                onUpdateBPM={updateBPM}
                onUpdateBeats={updateBeats}
                onUpdateSubdivisions={updateSubdivisions}
                onToggleMetrics={toggleMetrics}
                onToggleStress={toggleStress}
                onToggleMetronome={toggleMetronome}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toolbar */}
        <div className="bg-matte-black/80 backdrop-blur-md border-b border-white/5">
          <SongToolbar 
            onAddRow={handleAddRow}
            onAddSection={handleAddSection}
            onBakeAccents={handleBakeAccents}
            onPasteAnalyze={handlePasteAnalyze}
            onSave={performSave}
            onCopy={handleCopy}
            isSaved={isSaved}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-grow overflow-y-auto px-2 sm:px-6 lg:px-10 py-2 sm:py-5 space-y-0.5 custom-scrollbar pb-40" onPaste={handlePaste}>
        <div className="max-w-4xl lg:max-w-5xl mx-auto space-y-0.5">
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={rows.map(r => r.id)}
              strategy={verticalListSortingStrategy}
            >
              {rows.map(row => (
                <SortableRow key={row.id} id={row.id}>
                  <SongRow 
                    row={row}
                    settings={settings}
                    rhymeGroup={rhymeGroupsByRowId[row.id] || null}
                    sectionSummary={sectionSummariesByRowId[row.id] || null}
                    autoFocusId={autoFocusId}
                    onUpdate={handleUpdateRow}
                    onDelete={handleDeleteRow}
                    onDuplicate={handleDuplicateRow}
                    onMove={handleMoveRow}
                    onConvertToSection={handleConvertToSection}
                    onEnterRow={handleEnterRow}
                    onBackspaceEmpty={handleBackspaceEmpty}
                  />
                </SortableRow>
              ))}
            </SortableContext>
          </DndContext>
        </div>

        {rows.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-gray-600 italic">
            <p className="mb-4">Empty song. Start by adding a row.</p>
          </div>
        )}
        
        <div className="h-32" /> {/* Bottom spacer */}
      </div>

      {/* Analyze Modal */}
      {isAnalyzeModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="matte-card w-full max-w-2xl p-6 border-orange-accent/20 shadow-[0_0_50px_rgba(255,107,0,0.1)]">
            <h3 className="text-2xl font-bold mb-2 orange-text-gradient">Аналіз тексту</h3>
            <p className="text-gray-400 text-sm mb-6">Вставте текст пісні нижче. Система автоматично розіб'є його на блоки та рядки для аналізу ритму.</p>
            
            <textarea 
              autoFocus
              value={analyzeTextValue}
              onChange={(e) => setAnalyzeTextValue(e.target.value)}
              placeholder="Вставте текст тут... [Приклад: [Приспів] Ой у лузі...]"
              className="w-full h-64 bg-black/40 border border-white/10 rounded-xl p-4 text-gray-200 focus:outline-none focus:border-orange-accent/50 resize-none mb-6 font-sans leading-relaxed"
            />

            <div className="flex gap-4">
              <button 
                onClick={() => setIsAnalyzeModalOpen(false)}
                className="flex-1 py-4 bg-white/5 hover:bg-white/10 rounded-xl font-bold transition-all text-gray-400"
              >
                Скасувати
              </button>
              <button 
                onClick={performAnalysis}
                disabled={!analyzeTextValue.trim()}
                className="flex-1 py-4 bg-orange-accent hover:bg-orange-600 disabled:opacity-50 disabled:hover:bg-orange-accent text-black rounded-xl font-bold transition-all shadow-lg shadow-orange-accent/20"
              >
                Аналізувати
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SongEditor;


import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  TouchSensor,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
  ArrowLeft,
  Settings,
  Trash2,
  Save,
  Copy,
  Check,
  Tag,
  Download,
  Volume2,
  VolumeX,
  Lock,
  Sparkles,
  Folder,
  LayoutList,
  Ban,
  Zap,
  Music,
  X,
  Plus,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Note, Group } from '../../db';
import { useSongSettings } from '../../hooks/useSongSettings';
import { useMetronome } from '../../hooks/useMetronome';
import { SongContent, Row } from './types';
import {
  VOWELS,
  applyAccentsToText,
  analyzeText,
  compareRhymeSignatures,
} from '../../utils/prosodyEngine';
import SongSettingsPanel from './SongSettings';
import SongToolbar from './SongToolbar';
import SongRow, { SectionDeltaSummary } from './SongRow';
import { RhymeGroupBadge } from './MetricsRow';
import MetatagInlineBuilder from './MetatagInlineBuilder';
import {
  LATIN_SECTION_PRESETS,
  MUSICAL_KEY_PRESETS,
  EXCLUDE_STYLE_PRESETS,
  MAX_MODE_HEADER_BLOCK,
  normalizeSectionToLatin,
  MetatagChip,
  MetatagFormatMode,
  CustomMetatagStore,
  loadCustomMetatagStore,
  saveCustomMetatagStore,
  formatMetatagLine,
  parseMetatagLineToChips,
} from './sunoMetatagsData';

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

const KNOWN_SECTION_NAMES = new Set([
  'INTRO',
  'VERSE',
  'PRE-CHORUS',
  'PRECHORUS',
  'CHORUS',
  'HOOK',
  'POST-CHORUS',
  'INTERLUDE',
  'BRIDGE',
  'BUILD',
  'BUILD-UP',
  'BREAK',
  'DROP',
  'BREAKDOWN',
  'INSTRUMENTAL',
  'SOLO',
  'MOVEMENT',
  'OUTRO',
  'END',
  'ІНТРО',
  'ВСТУП',
  'КУПЛЕТ',
  'ПРЕ-ХОРУС',
  'ПЕРЕДПРИСПІВ',
  'ПРИСПІВ',
  'ХОРУС',
  'ХУК',
  'ІНТЕРЛЮДІЯ',
  'БРІДЖ',
  'БРИДЖ',
  'МІСТ',
  'БРЕЙК',
  'ПАУЗА',
  'ДРОП',
  'ІНСТРУМЕНТАЛ',
  'ПРОГРАШ',
  'СОЛО',
  'ЧАСТИНА',
  'АУТРО',
  'ФІНАЛ',
  'КОДА',
  'КІНЕЦЬ',
]);

function isKnownSectionHeader(rawLine: string): boolean {
  const trimmed = rawLine.trim();
  if (!trimmed.startsWith('[') || !trimmed.endsWith(']')) return false;
  // If there are multiple bracket groups on one line like "[TAG 1] [TAG 2]", it's a metatag line
  const groups = trimmed.match(/\[[^\]]+\]/g);
  if (groups && groups.length > 1) return false;
  const inside = trimmed
    .slice(1, -1)
    .replace(/\s*#?\d+\s*$/g, '')
    .trim()
    .toUpperCase();
  return KNOWN_SECTION_NAMES.has(inside);
}

const SortableRow = ({
  id,
  disabled,
  children,
}: {
  id: string;
  disabled?: boolean;
  children: React.ReactNode;
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled,
  });

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
            dragHandleProps: disabled ? {} : { ...attributes, ...listeners },
          });
        }
        return child;
      })}
    </div>
  );
};

const SongEditor: React.FC<SongEditorProps> = ({ note, groups, onSave, onClose, onDelete }) => {
  const {
    settings,
    updateBPM,
    updateBeats,
    updateSubdivisions,
    toggleMetrics,
    toggleStress,
    toggleMetronome,
    updateDictionary,
  } = useSongSettings();

  const { activeBeat } = useMetronome(
    settings.bpm,
    settings.beats,
    settings.subdivisions,
    settings.metronome
  );

  const [title, setTitle] = useState(note?.title || 'Untitled Song');
  const [rows, setRows] = useState<Row[]>([]);
  const [autoFocusId, setAutoFocusId] = useState<string | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMetatagMode, setIsMetatagMode] = useState(false);
  const [customMetatagStore, setCustomMetatagStore] = useState<CustomMetatagStore>(() =>
    loadCustomMetatagStore()
  );
  const [copiedStyle, setCopiedStyle] = useState(false);
  const [copiedExclude, setCopiedExclude] = useState(false);
  const [customExcludeInput, setCustomExcludeInput] = useState('');
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
    if (isMetatagMode) return;
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setRows(items => {
        const oldIndex = items.findIndex(i => i.id === active.id);
        const newIndex = items.findIndex(i => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
      setIsSaved(false);
    }
  };

  // Initialize data and normalize section headers to Latin
  useEffect(() => {
    if (note?.content) {
      try {
        const content: SongContent = JSON.parse(note.content);
        const normalizedRows = (content.rows || []).map(r =>
          r.isSection ? { ...r, text: normalizeSectionToLatin(r.text) } : r
        );
        setRows(normalizedRows);
        setCurrentId(note.id);
        if (content.dictionary) {
          updateDictionary({ ...settings.customDictionary, ...content.dictionary });
        }
        if (
          content.globalStyleChips ||
          content.excludeStyleChips ||
          content.metatagFormatMode ||
          content.musicalKey !== undefined ||
          content.lockKeyBpmInStyle !== undefined ||
          content.useMaxModeHeader !== undefined
        ) {
          setCustomMetatagStore(prev => {
            const next: CustomMetatagStore = {
              ...prev,
              globalStyleChips: content.globalStyleChips ?? prev.globalStyleChips,
              excludeStyleChips: content.excludeStyleChips ?? prev.excludeStyleChips,
              formatMode: content.metatagFormatMode ?? prev.formatMode,
              musicalKey: content.musicalKey ?? prev.musicalKey,
              lockKeyBpmInStyle: content.lockKeyBpmInStyle ?? prev.lockKeyBpmInStyle,
              useMaxModeHeader: content.useMaxModeHeader ?? prev.useMaxModeHeader,
            };
            saveCustomMetatagStore(next);
            return next;
          });
        }
      } catch (e) {
        console.error('Failed to parse song content', e);
        setRows([{ id: '1', text: '', isSection: false }]);
      }
    } else {
      setRows([
        { id: 'sec-1', text: '[VERSE]', isSection: true, metatags: [] },
        { id: '1', text: '', isSection: false },
      ]);
      setCurrentId(undefined);
    }
  }, [note]);

  const handleToggleMetatagMode = () => {
    setIsMetatagMode(prev => {
      const next = !prev;
      if (next) {
        setIsSettingsOpen(false);
        setShowGroupPicker(false);
        // Ensure all section rows are normalized to unnumbered Latin
        setRows(curr => {
          const hasSection = curr.some(r => r.isSection);
          const normalized = curr.map(r =>
            r.isSection ? { ...r, text: normalizeSectionToLatin(r.text) } : r
          );
          if (!hasSection) {
            return [
              { id: `sec-${Date.now()}`, text: '[VERSE]', isSection: true, metatags: [] },
              ...normalized,
            ];
          }
          return normalized;
        });
      }
      return next;
    });
  };

  const handleAddCustomTagToStore = useCallback(
    (subcategoryId: string, newTagLabel: string, parentTagLabel?: string) => {
      const clean = newTagLabel.replace(/[\[\]]/g, '').trim();
      if (!clean) return;

      setCustomMetatagStore(prev => {
        const existingList = prev.customTagsBySubcategory[subcategoryId] || [];
        const updatedList = existingList.some(t => t.toUpperCase() === clean.toUpperCase())
          ? existingList
          : [clean, ...existingList];

        const nextParentToSub = { ...prev.parentToNextSubcategory };
        const nextParentToCustom = { ...prev.parentToCustomTags };

        if (parentTagLabel) {
          const pUpper = parentTagLabel.trim().toUpperCase();
          nextParentToSub[pUpper] = subcategoryId;
          const prevLinked = nextParentToCustom[pUpper] || [];
          if (!prevLinked.some(t => t.toUpperCase() === clean.toUpperCase())) {
            nextParentToCustom[pUpper] = [clean, ...prevLinked];
          }
        }

        const nextStore: CustomMetatagStore = {
          ...prev,
          customTagsBySubcategory: {
            ...prev.customTagsBySubcategory,
            [subcategoryId]: updatedList,
          },
          parentToNextSubcategory: nextParentToSub,
          parentToCustomTags: nextParentToCustom,
        };
        saveCustomMetatagStore(nextStore);
        return nextStore;
      });
    },
    []
  );

  const handleSaveChainPreset = useCallback((name: string, chips: MetatagChip[]) => {
    setCustomMetatagStore(prev => {
      const newPreset = {
        id: `preset_${Date.now()}`,
        name,
        chips: chips.map(({ label, category, subcategoryId, isCustom }) => ({
          label,
          category,
          subcategoryId,
          isCustom,
        })),
      };
      const nextStore: CustomMetatagStore = {
        ...prev,
        chainPresets: [newPreset, ...prev.chainPresets],
      };
      saveCustomMetatagStore(nextStore);
      return nextStore;
    });
  }, []);

  const handleUpdateFormatMode = (mode: MetatagFormatMode) => {
    setCustomMetatagStore(prev => {
      const nextStore = { ...prev, formatMode: mode };
      saveCustomMetatagStore(nextStore);
      return nextStore;
    });
    setIsSaved(false);
  };

  const handleUpdateGlobalStyleChips = (chips: MetatagChip[]) => {
    setCustomMetatagStore(prev => {
      const nextStore = { ...prev, globalStyleChips: chips };
      saveCustomMetatagStore(nextStore);
      return nextStore;
    });
    setIsSaved(false);
  };

  const handleUpdateExcludeStyleChips = (chips: MetatagChip[]) => {
    setCustomMetatagStore(prev => {
      const nextStore = { ...prev, excludeStyleChips: chips };
      saveCustomMetatagStore(nextStore);
      return nextStore;
    });
    setIsSaved(false);
  };

  const handleApplyExcludePreset = (tags: string[]) => {
    setCustomMetatagStore(prev => {
      const existingUpper = new Set(prev.excludeStyleChips.map(c => c.label.toUpperCase()));
      const added: MetatagChip[] = [];
      tags.forEach(t => {
        if (!existingUpper.has(t.toUpperCase())) {
          existingUpper.add(t.toUpperCase());
          added.push({
            id: `excl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            label: t,
            category: 'style',
            subcategoryId: 'exclude',
          });
        }
      });
      const nextStore = {
        ...prev,
        excludeStyleChips: [...prev.excludeStyleChips, ...added],
      };
      saveCustomMetatagStore(nextStore);
      return nextStore;
    });
    setIsSaved(false);
  };

  const handleAddCustomExcludeTag = () => {
    const clean = customExcludeInput.trim();
    if (!clean) return;
    const pieces = clean
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    handleApplyExcludePreset(pieces);
    setCustomExcludeInput('');
  };

  const handleUpdateMusicalKey = (musicalKey: string) => {
    setCustomMetatagStore(prev => {
      const nextStore = { ...prev, musicalKey };
      saveCustomMetatagStore(nextStore);
      return nextStore;
    });
    setIsSaved(false);
  };

  const handleToggleLockKeyBpm = () => {
    setCustomMetatagStore(prev => {
      const nextStore = { ...prev, lockKeyBpmInStyle: !prev.lockKeyBpmInStyle };
      saveCustomMetatagStore(nextStore);
      return nextStore;
    });
    setIsSaved(false);
  };

  const handleToggleMaxModeHeader = () => {
    setCustomMetatagStore(prev => {
      const nextStore = { ...prev, useMaxModeHeader: !prev.useMaxModeHeader };
      saveCustomMetatagStore(nextStore);
      return nextStore;
    });
    setIsSaved(false);
  };

  // Serializes rows so that every [SECTION] with metatags outputs [SECTION] followed on the next line by [METATAGS]
  const serializeSongRowsToText = useCallback(
    (targetRows: Row[], formatMode: MetatagFormatMode, includeMaxHeader: boolean = false): string => {
      const lines: string[] = [];
      if (includeMaxHeader) {
        lines.push(MAX_MODE_HEADER_BLOCK);
        lines.push('');
      }
      targetRows.forEach(r => {
        if (r.isSection) {
          const secHeader = normalizeSectionToLatin(r.text);
          lines.push(secHeader);
          const metaLine = formatMetatagLine(r.metatags || [], formatMode);
          if (metaLine) {
            lines.push(metaLine);
          }
        } else {
          lines.push(r.text);
        }
      });
      return lines.join('\n');
    },
    []
  );

  const extractStressedWords = useCallback((rows: Row[]) => {
    const learned: Record<string, number> = {};
    rows.forEach(row => {
      if (row.isSection) return;
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

  // Compute cross-row Rhyme Link groups, Section Delta summaries, and Previous Section Metatags for 1-click inheritance
  const {
    rhymeGroupsByRowId,
    sectionSummariesByRowId,
    prevSameSectionChipsByRowId,
    prevAnySectionChipsByRowId,
  } = useMemo(() => {
    const rhymeMap: Record<string, RhymeGroupBadge> = {};
    const sectionMap: Record<string, SectionDeltaSummary> = {};
    const prevSameMap: Record<string, MetatagChip[] | null> = {};
    const prevAnyMap: Record<string, MetatagChip[] | null> = {};

    const lastChipsBySectionName: Record<string, MetatagChip[]> = {};
    let lastAnyChips: MetatagChip[] | null = null;

    interface Block {
      sectionRowId: string | null;
      lyricRows: { id: string; metrics: ReturnType<typeof analyzeText> }[];
    }

    const blocks: Block[] = [{ sectionRowId: null, lyricRows: [] }];

    rows.forEach(r => {
      if (r.isSection) {
        const normName = normalizeSectionToLatin(r.text);
        prevSameMap[r.id] = lastChipsBySectionName[normName] || null;
        prevAnyMap[r.id] = lastAnyChips;

        if (r.metatags && r.metatags.length > 0) {
          lastChipsBySectionName[normName] = r.metatags;
          lastAnyChips = r.metatags;
        }

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

    return {
      rhymeGroupsByRowId: rhymeMap,
      sectionSummariesByRowId: sectionMap,
      prevSameSectionChipsByRowId: prevSameMap,
      prevAnySectionChipsByRowId: prevAnyMap,
    };
  }, [rows, settings.bpm, settings.beats, settings.customDictionary, settings.subdivisions]);

  const performSave = useCallback(async () => {
    const learnedDict = extractStressedWords(rows);
    const finalDict = { ...settings.customDictionary, ...learnedDict };

    const content: SongContent = {
      settings: { ...settings, customDictionary: finalDict },
      rows,
      dictionary: finalDict,
      globalStyleChips: customMetatagStore.globalStyleChips,
      excludeStyleChips: customMetatagStore.excludeStyleChips,
      musicalKey: customMetatagStore.musicalKey,
      lockKeyBpmInStyle: customMetatagStore.lockKeyBpmInStyle,
      useMaxModeHeader: customMetatagStore.useMaxModeHeader,
      metatagFormatMode: customMetatagStore.formatMode,
    };

    const id = await onSave({
      id: currentId,
      title,
      content: JSON.stringify(content),
      plainText: serializeSongRowsToText(
        rows,
        customMetatagStore.formatMode,
        customMetatagStore.useMaxModeHeader
      ),
      type: 'song',
      groupId: selectedGroupId,
      createdAt: note?.createdAt,
    });

    if (!currentId) {
      setCurrentId(id);
    }
    setIsSaved(true);
  }, [
    note,
    title,
    rows,
    settings,
    onSave,
    extractStressedWords,
    currentId,
    selectedGroupId,
    customMetatagStore.globalStyleChips,
    customMetatagStore.excludeStyleChips,
    customMetatagStore.musicalKey,
    customMetatagStore.lockKeyBpmInStyle,
    customMetatagStore.useMaxModeHeader,
    customMetatagStore.formatMode,
    serializeSongRowsToText,
  ]);

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
    if (isMetatagMode) return;
    const newId = Date.now().toString();
    const newRow: Row = { id: newId, text: '', isSection: false };
    setRows(prev => [...prev, newRow]);
    setAutoFocusId(newId);
  };

  // New section blocks are ALWAYS Latin and UNNUMBERED
  const handleAddSection = (presetLabel: string = '[VERSE]') => {
    const newId = Date.now().toString();
    const newRow: Row = {
      id: newId,
      text: normalizeSectionToLatin(presetLabel),
      isSection: true,
      metatags: [],
    };
    setRows(prev => [...prev, newRow]);
    setAutoFocusId(newId);
  };

  const handleEnterRow = (id: string, textAfterCursor: string, textBeforeCursor: string) => {
    if (isMetatagMode) return;
    const index = rows.findIndex(r => r.id === id);
    if (index === -1) return;

    const newId = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const updatedCurrent: Row = { ...rows[index], text: textBeforeCursor };
    const insertedRow: Row = {
      id: newId,
      text: textAfterCursor,
      isSection: false,
    };

    const nextRows = [...rows];
    nextRows[index] = updatedCurrent;
    nextRows.splice(index + 1, 0, insertedRow);
    setRows(nextRows);
    setAutoFocusId(newId);
  };

  const handleBackspaceEmpty = (id: string) => {
    if (isMetatagMode || rows.length <= 1) return;
    const index = rows.findIndex(r => r.id === id);
    if (index === -1) return;

    const prevId = index > 0 ? rows[index - 1].id : rows[index + 1]?.id ?? null;
    setRows(rows.filter(r => r.id !== id));
    if (prevId) {
      setAutoFocusId(prevId);
    }
  };

  const handleUpdateRow = (id: string, text: string) => {
    setRows(rows.map(r => (r.id === id ? { ...r, text } : r)));
  };

  const handleUpdateMetatags = (id: string, chips: MetatagChip[]) => {
    setRows(rows.map(r => (r.id === id ? { ...r, metatags: chips } : r)));
    setIsSaved(false);
  };

  const handleDeleteRow = (id: string) => {
    if (isMetatagMode) return;
    setRows(rows.filter(r => r.id !== id));
  };

  const handleDuplicateRow = (id: string) => {
    if (isMetatagMode) return;
    const index = rows.findIndex(r => r.id === id);
    if (index !== -1) {
      const newRow = { ...rows[index], id: Date.now().toString() };
      const newRows = [...rows];
      newRows.splice(index + 1, 0, newRow);
      setRows(newRows);
    }
  };

  const handleMoveRow = (id: string, direction: 'up' | 'down') => {
    if (isMetatagMode) return;
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
    if (isMetatagMode) return;
    setRows(
      rows.map(r =>
        r.id === id
          ? {
              ...r,
              isSection: !r.isSection,
              text: r.isSection
                ? r.text.replace(/[\[\]]/g, '')
                : normalizeSectionToLatin(r.text || 'VERSE'),
            }
          : r
      )
    );
  };

  const handleBakeAccents = () => {
    if (isMetatagMode) return;
    const newRows = rows.map(row => {
      if (row.isSection) return row;
      return {
        ...row,
        text: applyAccentsToText(row.text, settings.customDictionary),
      };
    });
    setRows(newRows);
    setIsSaved(false);
  };

  const [copiedHeader, setCopiedHeader] = useState(false);

  const handleCopy = () => {
    const fullText = serializeSongRowsToText(
      rows,
      customMetatagStore.formatMode,
      customMetatagStore.useMaxModeHeader
    );
    navigator.clipboard.writeText(fullText);
    setCopiedHeader(true);
    setTimeout(() => setCopiedHeader(false), 1600);
  };

  const buildGlobalStylePromptText = useCallback(() => {
    const parts: string[] = [];
    if (customMetatagStore.lockKeyBpmInStyle) {
      parts.push(`Key: ${customMetatagStore.musicalKey || 'A Minor'}`);
      parts.push(`Tempo: ${settings.bpm} BPM`);
    }
    customMetatagStore.globalStyleChips.forEach(c => {
      if (c.label.trim()) parts.push(c.label.trim());
    });
    return parts.join(', ');
  }, [
    customMetatagStore.lockKeyBpmInStyle,
    customMetatagStore.musicalKey,
    customMetatagStore.globalStyleChips,
    settings.bpm,
  ]);

  const handleCopyGlobalStyle = () => {
    const styleLine = buildGlobalStylePromptText();
    if (!styleLine) return;
    navigator.clipboard.writeText(styleLine);
    setCopiedStyle(true);
    setTimeout(() => setCopiedStyle(false), 1600);
  };

  const handleCopyExcludeStyles = () => {
    const excludeLine = customMetatagStore.excludeStyleChips.map(c => c.label).join(', ');
    if (!excludeLine) return;
    navigator.clipboard.writeText(excludeLine);
    setCopiedExclude(true);
    setTimeout(() => setCopiedExclude(false), 1600);
  };

  const handleExport = () => {
    const fullText = serializeSongRowsToText(
      rows,
      customMetatagStore.formatMode,
      customMetatagStore.useMaxModeHeader
    );
    const blob = new Blob([fullText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'song'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Smart parser for pasted/analyzed text: converts section headers to unnumbered Latin and attaches bracketed metatag lines right below sections
  const parseRawLinesIntoRows = (rawText: string): Row[] => {
    const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const parsedRows: Row[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isBracketed = line.startsWith('[') && line.endsWith(']');

      if (isBracketed) {
        const lastRow = parsedRows[parsedRows.length - 1];
        // If previous row is a section and this line is a bracketed metatag line (not a new standard section name)
        if (lastRow && lastRow.isSection && !isKnownSectionHeader(line)) {
          const parsedChips = parseMetatagLineToChips(line);
          lastRow.metatags = [...(lastRow.metatags || []), ...parsedChips];
          continue;
        }

        parsedRows.push({
          id: Math.random().toString(36).substring(2, 11),
          text: normalizeSectionToLatin(line),
          isSection: true,
          metatags: [],
        });
      } else {
        parsedRows.push({
          id: Math.random().toString(36).substring(2, 11),
          text: line,
          isSection: false,
        });
      }
    }

    return parsedRows;
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    if (isMetatagMode) return;
    if (
      (e.target as HTMLElement).tagName === 'INPUT' ||
      (e.target as HTMLElement).tagName === 'TEXTAREA'
    ) {
      return;
    }

    e.preventDefault();
    const text = e.clipboardData.getData('text');
    if (!text) return;

    const newRows = parseRawLinesIntoRows(text);

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
    if (isMetatagMode) return;
    setAnalyzeTextValue('');
    setIsAnalyzeModalOpen(true);
  };

  const performAnalysis = () => {
    if (!analyzeTextValue.trim()) return;

    const newRows = parseRawLinesIntoRows(analyzeTextValue);

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
          isMetatagMode
            ? 'border-orange-accent/50 shadow-[0_6px_30px_rgba(255,107,0,0.16)]'
            : settings.metronome && activeBeat === 0
              ? 'border-orange-accent/40 shadow-[0_6px_30px_rgba(255,107,0,0.12)]'
              : 'border-white/5'
        }`}
      >
        <div className="flex items-center gap-2 sm:gap-4 flex-grow min-w-0">
          <button
            onClick={handleClose}
            className="p-1.5 sm:p-2 -ml-1 sm:-ml-2 text-gray-400 hover:text-white transition-colors cursor-pointer shrink-0"
          >
            <ArrowLeft size={22} />
          </button>
          <input
            value={title}
            readOnly={isMetatagMode}
            onChange={e => setTitle(e.target.value)}
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
            <div
              className="w-2 h-2 rounded-full bg-orange-accent shadow-[0_0_10px_rgba(255,107,0,0.5)] shrink-0"
              title="Є незбережені зміни"
            />
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
            title="Копіювати текст разом із метатегами"
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

          {/* METATAG / PROMPT GENERATOR MODE BUTTON (Tag Icon from User Screenshot) */}
          <button
            onClick={handleToggleMetatagMode}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border transition-all cursor-pointer ${
              isMetatagMode
                ? 'bg-orange-accent text-black border-orange-accent font-extrabold shadow-[0_0_18px_rgba(255,107,0,0.45)]'
                : 'text-gray-300 border-white/10 hover:border-orange-accent/40 hover:text-orange-accent bg-white/[0.03]'
            }`}
            title="Режим генератора метатегів та промпту Suno (блокує редагування тексту)"
          >
            <Tag size={16} />
            <span className="hidden md:inline text-[10px] uppercase tracking-wider font-extrabold">
              {isMetatagMode ? 'Metatags ON' : 'Metatags'}
            </span>
          </button>

          {/* Group Picker (Folder Icon) */}
          {groups.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowGroupPicker(!showGroupPicker)}
                className={`p-1.5 sm:p-2 rounded-full transition-all cursor-pointer ${
                  selectedGroupId
                    ? 'text-orange-accent bg-orange-accent/10'
                    : 'text-gray-400 hover:bg-white/5'
                }`}
                title="Вибрати групу"
              >
                <Folder size={18} />
              </button>

              {showGroupPicker && (
                <div className="absolute top-full right-0 mt-2 w-48 matte-card z-50 shadow-2xl border-orange-accent/20 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                  <button
                    onClick={() => {
                      setSelectedGroupId(undefined);
                      setShowGroupPicker(false);
                      setIsSaved(false);
                    }}
                    className="w-full p-3 text-left hover:bg-white/5 text-sm border-b border-white/5"
                  >
                    No Group
                  </button>
                  {groups.map(group => (
                    <button
                      key={group.id}
                      onClick={() => {
                        setSelectedGroupId(group.id);
                        setShowGroupPicker(false);
                        setIsSaved(false);
                      }}
                      className={`w-full p-3 text-left hover:bg-white/5 text-sm flex items-center gap-2 ${
                        selectedGroupId === group.id ? 'text-orange-accent' : 'text-gray-300'
                      }`}
                    >
                      <Folder size={14} />
                      {group.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => {
              if (!isMetatagMode) setIsSettingsOpen(!isSettingsOpen);
            }}
            className={`p-1.5 sm:p-2 rounded-full transition-all cursor-pointer ${
              isSettingsOpen
                ? 'bg-orange-accent text-black shadow-[0_0_15px_rgba(255,107,0,0.4)]'
                : 'text-gray-400 hover:bg-white/5'
            }`}
            title="Налаштування ритму та метрики"
          >
            <Settings size={19} />
          </button>
          {note?.id && !isMetatagMode && (
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
          {isSettingsOpen && !isMetatagMode && (
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

        {/* Metatag Studio Control Bar OR Standard Lyric Toolbar */}
        {isMetatagMode ? (
          <div className="bg-[#111216]/95 backdrop-blur-xl border-b border-orange-accent/30 px-3 sm:px-6 py-2.5 animate-in fade-in duration-150">
            <div className="max-w-4xl lg:max-w-5xl mx-auto space-y-2">
              {/* Top Row: Lock Banner + MAX Mode Header Toggle + Format Switcher + Quick Section Adder */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-accent/20 border border-orange-accent/40 text-orange-accent text-[10px] font-extrabold uppercase tracking-wider">
                    <Lock size={11} />
                    <span>Текст заблоковано • Suno Field Guide</span>
                  </span>

                  {/* MAX Mode + [START_ON: TRUE] Header Toggle */}
                  <button
                    type="button"
                    onClick={handleToggleMaxModeHeader}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer ${
                      customMetatagStore.useMaxModeHeader
                        ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                        : 'bg-white/[0.03] border-white/10 text-gray-400 hover:text-white'
                    }`}
                    title="Додає шапку [Is_MAX_MODE: MAX], [REALISM: MAX] та [START_ON: TRUE] перед текстом пісні при копіюванні"
                  >
                    <Zap size={11} />
                    <span>MAX + START_ON: {customMetatagStore.useMaxModeHeader ? 'ON' : 'OFF'}</span>
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {/* Format Mode Toggle */}
                  <div className="flex items-center bg-black/50 border border-white/10 rounded-lg p-0.5">
                    {(
                      [
                        { id: 'grouped', label: '[A, B] [DROP]' },
                        { id: 'pipes', label: '[A | B | DROP]' },
                        { id: 'separate', label: '[A] [B] [DROP]' },
                      ] as { id: MetatagFormatMode; label: string }[]
                    ).map(fmt => (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => handleUpdateFormatMode(fmt.id)}
                        className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold transition-all cursor-pointer ${
                          customMetatagStore.formatMode === fmt.id
                            ? 'bg-orange-accent text-black'
                            : 'text-gray-400 hover:text-white'
                        }`}
                        title="Формат склеювання метатегів у рядку під блоком"
                      >
                        {fmt.label}
                      </button>
                    ))}
                  </div>

                  {/* Quick Insert Unnumbered Latin Section */}
                  <button
                    type="button"
                    onClick={() => handleAddSection('[VERSE]')}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-[10px] font-bold uppercase text-gray-200 cursor-pointer"
                  >
                    <LayoutList size={11} className="text-orange-accent" />
                    <span>+ Блок</span>
                  </button>

                  {/* Copy Full Suno Script */}
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase transition-all cursor-pointer ${
                      copiedHeader
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-orange-accent/20 hover:bg-orange-accent/30 border-orange-accent/50 text-orange-accent'
                    }`}
                  >
                    {copiedHeader ? <Check size={11} /> : <Copy size={11} />}
                    <span>{copiedHeader ? 'Скопійовано!' : 'Copy Suno Текст'}</span>
                  </button>
                </div>
              </div>

              {/* Global Style of Music Prompt Builder + Key & BPM Lock (Budmaniak Workflow) */}
              <div className="p-2 rounded-xl bg-black/40 border border-white/10">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-1.5">
                      <Sparkles size={12} className="text-orange-accent" />
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-300">
                        Style of Music
                      </span>
                    </div>

                    {/* Key + BPM Lock Controls */}
                    <div className="flex items-center gap-1 bg-white/[0.03] border border-white/10 rounded-lg px-1.5 py-0.5">
                      <button
                        type="button"
                        onClick={handleToggleLockKeyBpm}
                        className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase transition-all cursor-pointer ${
                          customMetatagStore.lockKeyBpmInStyle
                            ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/40'
                            : 'text-gray-500 hover:text-gray-300'
                        }`}
                        title="Автоматично додає Key та Tempo (BPM) на початок поля Style of Music"
                      >
                        <Music size={10} />
                        <span>
                          {customMetatagStore.lockKeyBpmInStyle
                            ? `Lock: ${customMetatagStore.musicalKey} • ${settings.bpm} BPM`
                            : 'Key/BPM Lock OFF'}
                        </span>
                      </button>

                      {customMetatagStore.lockKeyBpmInStyle && (
                        <select
                          value={customMetatagStore.musicalKey}
                          onChange={e => handleUpdateMusicalKey(e.target.value)}
                          className="bg-black/70 text-cyan-200 text-[9px] font-mono font-bold rounded px-1 py-0.5 border border-white/10 focus:outline-none focus:border-cyan-400/50 cursor-pointer"
                          title="Вибрати тональність треку для фіксації в Style of Music"
                        >
                          {MUSICAL_KEY_PRESETS.map(k => (
                            <option key={k} value={k} className="bg-[#121318] text-gray-200">
                              {k}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {(customMetatagStore.globalStyleChips.length > 0 ||
                    customMetatagStore.lockKeyBpmInStyle) && (
                    <button
                      type="button"
                      onClick={handleCopyGlobalStyle}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-orange-accent/15 hover:bg-orange-accent/25 border border-orange-accent/40 text-orange-accent text-[9px] font-bold uppercase cursor-pointer"
                    >
                      {copiedStyle ? <Check size={10} /> : <Copy size={10} />}
                      <span>{copiedStyle ? 'Style скопійовано' : 'Copy Style Prompt'}</span>
                    </button>
                  )}
                </div>

                <MetatagInlineBuilder
                  sectionHeader="[STYLE]"
                  chips={customMetatagStore.globalStyleChips}
                  isMetatagMode={true}
                  customStore={customMetatagStore}
                  onChangeChips={handleUpdateGlobalStyleChips}
                  onAddCustomTagToStore={handleAddCustomTagToStore}
                  onSaveChainPreset={handleSaveChainPreset}
                />
              </div>

              {/* Exclude Styles (Negative Prompt) Builder with PureRely Anti-Intro-Hum & Pop Gravity Presets */}
              <div className="p-2 rounded-xl bg-black/40 border border-rose-500/20">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Ban size={12} className="text-rose-400" />
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-rose-200/90">
                      Exclude Styles (Негативний промпт):
                    </span>

                    {/* 1-Click Field Guide Exclude Presets */}
                    {EXCLUDE_STYLE_PRESETS.map(preset => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => handleApplyExcludePreset(preset.tags)}
                        className="px-2 py-0.5 rounded-md bg-rose-500/10 hover:bg-rose-500/20 border border-rose-400/30 text-rose-300 text-[9px] font-bold transition-all cursor-pointer"
                        title={`${preset.uaHint}: ${preset.tags.join(', ')}`}
                      >
                        + {preset.name}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {customMetatagStore.excludeStyleChips.length > 0 && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleUpdateExcludeStyleChips([])}
                          className="px-1.5 py-0.5 rounded bg-white/5 hover:bg-rose-500/20 text-gray-400 hover:text-rose-300 text-[9px] font-bold uppercase cursor-pointer"
                          title="Очистити Exclude Styles"
                        >
                          Очистити
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyExcludeStyles}
                          className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/20 hover:bg-rose-500/30 border border-rose-400/50 text-rose-200 text-[9px] font-bold uppercase cursor-pointer"
                        >
                          {copiedExclude ? <Check size={10} /> : <Copy size={10} />}
                          <span>{copiedExclude ? 'Exclude скопійовано' : 'Copy Exclude'}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Exclude Capsules + Manual Input */}
                <div className="flex flex-wrap items-center gap-1">
                  {customMetatagStore.excludeStyleChips.map(chip => (
                    <span
                      key={chip.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-950/40 border border-rose-400/40 text-rose-200 text-[10px] font-mono"
                    >
                      <span>{chip.label}</span>
                      <button
                        type="button"
                        onClick={() =>
                          handleUpdateExcludeStyleChips(
                            customMetatagStore.excludeStyleChips.filter(c => c.id !== chip.id)
                          )
                        }
                        className="text-rose-400/70 hover:text-rose-200 cursor-pointer"
                        title="Видалити з виключень"
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}

                  <div className="inline-flex items-center gap-1 bg-black/50 border border-white/10 rounded-md px-1.5 py-0.5">
                    <input
                      type="text"
                      value={customExcludeInput}
                      onChange={e => setCustomExcludeInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddCustomExcludeTag();
                        }
                      }}
                      placeholder="+ виключити стиль (Enter)..."
                      className="bg-transparent text-[10px] text-gray-200 placeholder-gray-500 focus:outline-none w-36 sm:w-44 font-mono"
                    />
                    {customExcludeInput.trim() && (
                      <button
                        type="button"
                        onClick={handleAddCustomExcludeTag}
                        className="text-rose-300 hover:text-white cursor-pointer"
                        title="Додати у виключення"
                      >
                        <Plus size={11} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-matte-black/80 backdrop-blur-md border-b border-white/5">
            <SongToolbar
              onAddRow={handleAddRow}
              onAddSection={() => handleAddSection('[VERSE]')}
              onBakeAccents={handleBakeAccents}
              onPasteAnalyze={handlePasteAnalyze}
              onSave={performSave}
              onCopy={handleCopy}
              isSaved={isSaved}
            />
          </div>
        )}
      </div>

      {/* Content */}
      <div
        className="flex-grow overflow-y-auto px-2 sm:px-6 lg:px-10 py-2 sm:py-5 space-y-0.5 custom-scrollbar pb-40"
        onPaste={handlePaste}
      >
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
                <SortableRow key={row.id} id={row.id} disabled={isMetatagMode}>
                  <SongRow
                    row={row}
                    settings={settings}
                    rhymeGroup={rhymeGroupsByRowId[row.id] || null}
                    sectionSummary={sectionSummariesByRowId[row.id] || null}
                    autoFocusId={autoFocusId}
                    isMetatagMode={isMetatagMode}
                    customMetatagStore={customMetatagStore}
                    previousSameSectionChips={prevSameSectionChipsByRowId[row.id] || null}
                    previousAnySectionChips={prevAnySectionChipsByRowId[row.id] || null}
                    onUpdate={handleUpdateRow}
                    onUpdateMetatags={handleUpdateMetatags}
                    onAddCustomTagToStore={handleAddCustomTagToStore}
                    onSaveChainPreset={handleSaveChainPreset}
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
            <p className="text-gray-400 text-sm mb-6">
              Вставте текст пісні нижче. Система автоматично розіб'є його на латинські блоки
              ([VERSE], [CHORUS] тощо), підтягне метатеги та проаналізує ритм.
            </p>

            <textarea
              autoFocus
              value={analyzeTextValue}
              onChange={e => setAnalyzeTextValue(e.target.value)}
              placeholder="Вставте текст тут... [Приклад: [VERSE] Ой у лузі...]"
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

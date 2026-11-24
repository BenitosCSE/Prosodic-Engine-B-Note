import React, { useRef, useEffect, useState, useCallback } from 'react';
import { MoreVertical, Trash2, ArrowUp, ArrowDown, LayoutList, Lock, Sparkles } from 'lucide-react';
import { Row } from './types';
import { SongSettings } from '../../hooks/useSongSettings';
import { useProsody } from '../../hooks/useProsody';
import { VOWELS, analyzeTextCached } from '../../utils/prosodyEngine';
import {
  AnchorLineInfo,
  RankedRhymeCandidate,
  queryAndRankRhymes,
} from '../../utils/rhymeEngine';
import MetricsRow, { RhymeGroupBadge } from './MetricsRow';
import StressOverlay from './StressOverlay';
import MetatagInlineBuilder from './MetatagInlineBuilder';
import RhymeSuggestionsDropdown from './RhymeSuggestionsDropdown';
import {
  LATIN_SECTION_PRESETS,
  normalizeSectionToLatin,
  MetatagChip,
  CustomMetatagStore,
} from './sunoMetatagsData';

export interface SectionDeltaSummary {
  lineCount: number;
  syllablePattern: string;
  dominantMeter: string;
  avgSingability: number;
  minBpmMax: number;
}

interface SongRowProps {
  row: Row;
  settings: SongSettings;
  rhymeGroup?: RhymeGroupBadge | null;
  sectionSummary?: SectionDeltaSummary | null;
  anchorLineInfo?: AnchorLineInfo | null;
  autoFocusId?: string | null;
  isMetatagMode?: boolean;
  customMetatagStore: CustomMetatagStore;
  previousSameSectionChips?: MetatagChip[] | null;
  previousAnySectionChips?: MetatagChip[] | null;
  onFocusRow?: (id: string, manualTrigger?: boolean) => void;
  onUpdate: (id: string, text: string) => void;
  onUpdateMetatags: (id: string, chips: MetatagChip[]) => void;
  onAddCustomTagToStore: (
    subcategoryId: string,
    newTagLabel: string,
    parentTagLabel?: string
  ) => void;
  onSaveChainPreset: (name: string, chips: MetatagChip[]) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onConvertToSection: (id: string) => void;
  onEnterRow?: (id: string, textAfterCursor: string, textBeforeCursor: string) => void;
  onBackspaceEmpty?: (id: string) => void;
  dragHandleProps?: any;
}

const WORD_CHAR_REGEX = /[a-zA-Zа-яА-ЯіїєґІЇЄҐ\u0301'’ʼ‘`]/;

const SongRow: React.FC<SongRowProps> = ({
  row,
  settings,
  rhymeGroup,
  sectionSummary,
  anchorLineInfo = null,
  autoFocusId,
  isMetatagMode = false,
  customMetatagStore,
  previousSameSectionChips,
  previousAnySectionChips,
  onFocusRow,
  onUpdate,
  onUpdateMetatags,
  onAddCustomTagToStore,
  onSaveChainPreset,
  onDelete,
  onMove,
  onEnterRow,
  onBackspaceEmpty,
  dragHandleProps,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sectionInputRef = useRef<HTMLInputElement>(null);
  const { metrics } = useProsody(row.text, settings);

  const [isRowExpanded, setIsRowExpanded] = useState(false);
  const [isSectionExpanded, setIsSectionExpanded] = useState(false);

  // Live Rhyme Suggestions State
  const [rhymeCandidates, setRhymeCandidates] = useState<RankedRhymeCandidate[]>([]);
  const [selectedRhymeIdx, setSelectedRhymeIdx] = useState(0);
  const [isRhymeDismissed, setIsRhymeDismissed] = useState(false);
  const [manualRhymeTrigger, setManualRhymeTrigger] = useState(false);
  const [insertWithAccent, setInsertWithAccent] = useState(settings.showStressHighlight);
  const [excludeVerbs, setExcludeVerbs] = useState(false);
  const [rhymeQueryTimeMs, setRhymeQueryTimeMs] = useState(0);
  const [activeDeltaS, setActiveDeltaS] = useState(2);

  useEffect(() => {
    setInsertWithAccent(settings.showStressHighlight);
  }, [settings.showStressHighlight]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [row.text]);

  useEffect(() => {
    if (autoFocusId === row.id && !isMetatagMode) {
      if (row.isSection && sectionInputRef.current) {
        sectionInputRef.current.focus();
      } else if (textareaRef.current) {
        textareaRef.current.focus();
        const len = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(len, len);
      }
    }
  }, [autoFocusId, row.id, row.isSection, isMetatagMode]);

  // Split current line into completed prefix before the tail word vs partial tail word
  const parseLinePrefixAndTail = useCallback((text: string) => {
    const endsWithSpace = /\s$/.test(text);
    if (endsWithSpace || !text.trim()) {
      return { prefixText: text.trimEnd(), partialWord: '' };
    }
    const match = text.match(/^(.*?\s)?([a-zA-Zа-яА-ЯіїєґІЇЄҐ\u0301'’ʼ‘`]+)$/);
    if (!match) {
      return { prefixText: text, partialWord: '' };
    }
    return {
      prefixText: (match[1] || '').trimEnd(),
      partialWord: match[2] || '',
    };
  }, []);

  // Debounced Live Rhyme Trigger when ΔS = S_target - S_current is in 1..3 (or manual Ctrl+Space)
  useEffect(() => {
    if (
      row.isSection ||
      isMetatagMode ||
      !isRowExpanded ||
      !anchorLineInfo ||
      (isRhymeDismissed && !manualRhymeTrigger)
    ) {
      setRhymeCandidates([]);
      return;
    }

    const currentS = metrics?.S ?? 0;
    const targetS = anchorLineInfo.targetSyllables;
    const rawDelta = targetS - currentS;

    const { prefixText, partialWord } = parseLinePrefixAndTail(row.text);
    const prefixMetrics = prefixText
      ? analyzeTextCached(
          prefixText,
          settings.bpm,
          settings.beats,
          settings.customDictionary,
          settings.subdivisions
        )
      : null;
    const prefixS = prefixMetrics?.S ?? 0;
    const deltaFromPrefix = targetS - prefixS;

    // Trigger automatically when user has written at least 2 syllables and remaining ΔS is 1..3
    const autoInZone =
      currentS >= 2 &&
      ((rawDelta >= 1 && rawDelta <= 3) ||
        (partialWord.length > 0 && deltaFromPrefix >= 1 && deltaFromPrefix <= 3));

    if (!autoInZone && !manualRhymeTrigger) {
      setRhymeCandidates([]);
      return;
    }

    const effectiveDeltaS =
      rawDelta >= 1 && rawDelta <= 3
        ? rawDelta
        : deltaFromPrefix >= 1 && deltaFromPrefix <= 4
          ? deltaFromPrefix
          : Math.max(1, Math.min(3, rawDelta > 0 ? rawDelta : 2));

    const usePrefixFilter = rawDelta < 1 && partialWord.length >= 1 ? partialWord : '';
    const baseTextForJunction = usePrefixFilter ? prefixText : row.text.trimEnd();
    const baseMetricsForJunction = usePrefixFilter ? prefixMetrics : metrics;

    const timer = setTimeout(async () => {
      const res = await queryAndRankRhymes({
        rhymeSignature: anchorLineInfo.rhymeSignature,
        anchorWord: anchorLineInfo.anchorWord,
        deltaS: effectiveDeltaS,
        linePrefixText: baseTextForJunction,
        prefixWordFilter: usePrefixFilter,
        currentLineMetrics: baseMetricsForJunction,
        bpm: settings.bpm,
        beats: settings.beats,
        excludeVerbs,
      });
      setActiveDeltaS(effectiveDeltaS);
      setRhymeCandidates(res.candidates);
      setRhymeQueryTimeMs(res.queryTimeMs);
      setSelectedRhymeIdx(0);
    }, 55);

    return () => clearTimeout(timer);
  }, [
    row.text,
    row.isSection,
    isMetatagMode,
    isRowExpanded,
    anchorLineInfo,
    isRhymeDismissed,
    manualRhymeTrigger,
    excludeVerbs,
    metrics,
    settings.bpm,
    settings.beats,
    settings.customDictionary,
    settings.subdivisions,
    parseLinePrefixAndTail,
  ]);

  const handleInsertRhymeCandidate = (cand: RankedRhymeCandidate) => {
    const wordToInsert = insertWithAccent ? cand.stressedWord : cand.word;
    const currentS = metrics?.S ?? 0;
    const targetS = anchorLineInfo?.targetSyllables ?? 8;
    const rawDelta = targetS - currentS;
    const { prefixText, partialWord } = parseLinePrefixAndTail(row.text);

    let nextText = '';
    if (rawDelta >= 1 && !/\s$/.test(row.text) && partialWord.length > 0 && rawDelta <= 3) {
      // User finished a word and hasn't typed a space yet, or is appending the final word
      nextText = `${row.text.trimEnd()} ${wordToInsert}`;
    } else if (/\s$/.test(row.text) || !row.text.trim()) {
      nextText = `${row.text.trimEnd()}${row.text.trim() ? ' ' : ''}${wordToInsert}`;
    } else {
      // Replace partial word at end of line
      nextText = prefixText ? `${prefixText} ${wordToInsert}` : wordToInsert;
    }

    onUpdate(row.id, nextText);
    setRhymeCandidates([]);
    setManualRhymeTrigger(false);
    setIsRhymeDismissed(true);

    setTimeout(() => {
      if (textareaRef.current) {
        const len = nextText.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(len, len);
      }
    }, 0);
  };

  const applyAccentAtCharIndex = (val: string, targetCharIndex: number) => {
    if (isMetatagMode) return;
    let wordStart = targetCharIndex;
    while (wordStart > 0 && WORD_CHAR_REGEX.test(val[wordStart - 1])) {
      wordStart--;
    }
    let wordEnd = targetCharIndex + 1;
    while (wordEnd < val.length && WORD_CHAR_REGEX.test(val[wordEnd])) {
      wordEnd++;
    }

    const beforeWord = val.substring(0, wordStart);
    const rawLeftPart = val.substring(wordStart, targetCharIndex + 1);
    const rawRightPart = val.substring(targetCharIndex + 1, wordEnd);
    const afterWord = val.substring(wordEnd);

    const alreadyAccentedHere = val[targetCharIndex + 1] === '\u0301';
    const cleanLeftPart = rawLeftPart.replace(/\u0301/g, '');
    const cleanRightPart = rawRightPart.replace(/\u0301/g, '');

    const newVal = alreadyAccentedHere
      ? beforeWord + cleanLeftPart + cleanRightPart + afterWord
      : beforeWord + cleanLeftPart + '\u0301' + cleanRightPart + afterWord;
    const newPos = beforeWord.length + cleanLeftPart.length + (alreadyAccentedHere ? 0 : 1);

    onUpdate(row.id, newVal);

    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.setSelectionRange(newPos, newPos);
        textareaRef.current.focus();
      }
    }, 0);
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (isMetatagMode) return;
    const val = e.target.value;
    const cursor = e.target.selectionStart;

    setIsRhymeDismissed(false);

    // Shortcut logic: letter + . + space + space
    if (cursor !== null && cursor >= 4) {
      const last4 = val.substring(cursor - 4, cursor);
      if (/[a-zA-Zа-яА-ЯіїєґІЇЄҐ]\.  /.test(last4)) {
        const targetCharIndex = cursor - 4;
        const strippedDotSpace = val.substring(0, cursor - 3) + val.substring(cursor);
        applyAccentAtCharIndex(strippedDotSpace, targetCharIndex);
        return;
      }
    }

    onUpdate(row.id, val);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (isMetatagMode) {
      e.preventDefault();
      return;
    }

    // Manual trigger for Rhyme Dropdown: Ctrl + Space
    if ((e.ctrlKey || e.metaKey) && (e.code === 'Space' || e.key === ' ')) {
      e.preventDefault();
      setIsRhymeDismissed(false);
      setManualRhymeTrigger(true);
      onFocusRow?.(row.id, true);
      return;
    }

    // Keyboard navigation when Live Rhyme Dropdown is open
    if (rhymeCandidates.length > 0 && isRowExpanded) {
      const visibleCount = Math.min(12, rhymeCandidates.length);
      if (e.key === 'ArrowDown' && !e.altKey) {
        e.preventDefault();
        setSelectedRhymeIdx(prev => (prev + 1) % visibleCount);
        return;
      }
      if (e.key === 'ArrowUp' && !e.altKey) {
        e.preventDefault();
        setSelectedRhymeIdx(prev => (prev - 1 + visibleCount) % visibleCount);
        return;
      }
      if ((e.key === 'Enter' && !e.shiftKey) || e.key === 'Tab') {
        e.preventDefault();
        const chosen = rhymeCandidates[selectedRhymeIdx] || rhymeCandidates[0];
        if (chosen) {
          handleInsertRhymeCandidate(chosen);
        }
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setRhymeCandidates([]);
        setIsRhymeDismissed(true);
        setManualRhymeTrigger(false);
        return;
      }
    }

    // Alt + ArrowUp / ArrowDown: move row up/down
    if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      onMove(row.id, e.key === 'ArrowUp' ? 'up' : 'down');
      return;
    }

    // Enter (without Shift): split/insert new row below
    if (e.key === 'Enter' && !e.shiftKey && onEnterRow) {
      e.preventDefault();
      const cursor = e.currentTarget.selectionStart ?? row.text.length;
      const before = row.text.substring(0, cursor);
      const after = row.text.substring(cursor);
      onEnterRow(row.id, after, before);
      return;
    }

    // Backspace on empty row: delete row and focus previous
    if (e.key === 'Backspace' && row.text === '' && onBackspaceEmpty) {
      e.preventDefault();
      onBackspaceEmpty(row.id);
    }
  };

  const handleTextareaClick = (e: React.MouseEvent<HTMLTextAreaElement>) => {
    if (isMetatagMode || !e.altKey) return;
    const pos = e.currentTarget.selectionStart;
    if (pos === null) return;

    const val = row.text;
    const candidates = [pos, pos - 1].filter(idx => idx >= 0 && idx < val.length);
    for (const idx of candidates) {
      const ch = val[idx];
      if (VOWELS.has(ch.toLowerCase())) {
        e.preventDefault();
        applyAccentAtCharIndex(val, idx);
        break;
      }
    }
  };

  const handleToggleSyllableStress = (segmentIdx: number, syllableIdxInSegment: number) => {
    if (isMetatagMode || !metrics) return;

    const updatedText = metrics.segments
      .map((seg, sIdx) => {
        if (sIdx !== segmentIdx || seg.type === 'separator') {
          return seg.text;
        }

        const cleanWord = seg.text.replace(/\u0301/g, '');
        let vowelCounter = 0;
        let rebuilt = '';

        for (let i = 0; i < cleanWord.length; i++) {
          const ch = cleanWord[i];
          rebuilt += ch;
          if (VOWELS.has(ch.toLowerCase())) {
            if (vowelCounter === syllableIdxInSegment) {
              rebuilt += '\u0301';
            }
            vowelCounter++;
          }
        }
        return rebuilt;
      })
      .join('');

    onUpdate(row.id, updatedText);
  };

  const handleMobileFocusScroll = (el: HTMLElement | null) => {
    if (!el || typeof window === 'undefined') return;
    if (window.innerWidth < 768) {
      setTimeout(() => {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 180);
    }
  };

  if (row.isSection) {
    const normalizedDisplay = normalizeSectionToLatin(row.text);

    return (
      <div
        onClick={() => {
          if (!isMetatagMode) setIsSectionExpanded(prev => !prev);
        }}
        className={`group relative py-1.5 px-2.5 sm:px-3 my-1.5 matte-card rounded-xl select-none transition-all ${
          isMetatagMode
            ? 'border-orange-accent/55 bg-[#121317] shadow-[0_0_25px_rgba(255,107,0,0.08)]'
            : 'border-orange-accent/20 cursor-pointer'
        }`}
      >
        <div className="flex items-center gap-2">
          {!isMetatagMode && (
            <div
              {...dragHandleProps}
              onClick={e => e.stopPropagation()}
              className="cursor-grab active:cursor-grabbing p-1 text-gray-500 hover:text-orange-accent transition-colors shrink-0"
            >
              <LayoutList size={14} />
            </div>
          )}
          <div className="h-px flex-grow bg-gradient-to-r from-transparent via-orange-accent/30 to-orange-accent/10 hidden sm:block" />
          <input
            ref={sectionInputRef}
            value={row.text}
            readOnly={isMetatagMode}
            onClick={e => {
              e.stopPropagation();
              if (!isMetatagMode) setIsSectionExpanded(prev => !prev);
            }}
            onChange={e => {
              if (isMetatagMode) return;
              const raw = e.target.value.toUpperCase().replace(/[0-9]/g, '');
              onUpdate(row.id, raw);
            }}
            onBlur={() => {
              if (!isMetatagMode) {
                onUpdate(row.id, normalizeSectionToLatin(row.text));
              }
            }}
            onFocus={e => handleMobileFocusScroll(e.currentTarget)}
            className="bg-transparent text-orange-accent font-black uppercase tracking-[0.2em] text-center focus:outline-none min-w-[100px] flex-grow sm:flex-grow-0 drop-shadow-[0_0_12px_rgba(255,107,0,0.25)] text-xs sm:text-sm cursor-pointer"
            placeholder="[VERSE]"
            spellCheck={false}
          />
          {!isSectionExpanded && sectionSummary && sectionSummary.lineCount > 0 && (
            <span className="text-[8px] uppercase tracking-wider text-gray-500 font-bold shrink-0">
              {sectionSummary.lineCount}р • {sectionSummary.avgSingability}%
            </span>
          )}
          <div className="h-px flex-grow bg-gradient-to-l from-transparent via-orange-accent/30 to-orange-accent/10 hidden sm:block" />

          {!isMetatagMode && (
            <div
              onClick={e => e.stopPropagation()}
              className="touch-visible-hover transition-opacity flex gap-0.5 bg-matte-black/90 border border-white/10 rounded-lg px-1 py-0.5 shrink-0"
            >
              <button
                onClick={() => onMove(row.id, 'up')}
                className="p-1 text-gray-400 hover:text-white cursor-pointer"
                title="Alt+↑"
              >
                <ArrowUp size={12} />
              </button>
              <button
                onClick={() => onMove(row.id, 'down')}
                className="p-1 text-gray-400 hover:text-white cursor-pointer"
                title="Alt+↓"
              >
                <ArrowDown size={12} />
              </button>
              <button
                onClick={() => onDelete(row.id)}
                className="p-1 text-gray-400 hover:text-red-400 cursor-pointer"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>

        {(isSectionExpanded || isMetatagMode) && (
          <div
            onClick={e => e.stopPropagation()}
            className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-1.5 mt-1.5 pt-1.5 border-t border-white/5 px-1 sm:px-2 animate-in fade-in duration-150"
          >
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5 sm:flex-wrap">
              {LATIN_SECTION_PRESETS.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onUpdate(row.id, preset)}
                  className={`shrink-0 text-[9px] px-2 py-0.5 rounded border transition-all cursor-pointer uppercase font-mono ${
                    normalizedDisplay === preset
                      ? 'bg-orange-accent/20 border-orange-accent/50 text-orange-accent font-bold shadow-[0_0_10px_rgba(255,107,0,0.15)]'
                      : 'bg-white/[0.03] border-white/5 text-gray-400 hover:text-gray-200 hover:border-white/15'
                  }`}
                >
                  {preset.replace(/[\[\]]/g, '')}
                </button>
              ))}
            </div>

            {!isMetatagMode && sectionSummary && sectionSummary.lineCount > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[8.5px] uppercase tracking-wider text-gray-400 font-bold bg-black/40 px-2 py-0.5 rounded-md border border-white/10 self-start sm:self-auto">
                <span>{sectionSummary.lineCount} рядк.</span>
                <span className="opacity-30">•</span>
                <span
                  className="text-orange-accent/90"
                  title="Складова структура рядків секції"
                >
                  {sectionSummary.syllablePattern} скл
                </span>
                {sectionSummary.dominantMeter && sectionSummary.dominantMeter !== '—' && (
                  <>
                    <span className="opacity-30">•</span>
                    <span className="text-gray-300">{sectionSummary.dominantMeter}</span>
                  </>
                )}
                <span className="opacity-30">•</span>
                <span>співучість {sectionSummary.avgSingability}%</span>
              </div>
            )}
          </div>
        )}

        <MetatagInlineBuilder
          sectionHeader={normalizedDisplay}
          chips={row.metatags || []}
          isMetatagMode={isMetatagMode}
          customStore={customMetatagStore}
          previousSameSectionChips={previousSameSectionChips}
          previousAnySectionChips={previousAnySectionChips}
          onChangeChips={nextChips => onUpdateMetatags(row.id, nextChips)}
          onAddCustomTagToStore={onAddCustomTagToStore}
          onSaveChainPreset={onSaveChainPreset}
        />
      </div>
    );
  }

  // Regular Lyric Row
  return (
    <div
      onBlur={e => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsRowExpanded(false);
          setRhymeCandidates([]);
          setManualRhymeTrigger(false);
        }
      }}
      className={`studio-row group relative py-0.5 px-1 sm:px-2 rounded-lg flex items-start gap-1 sm:gap-1.5 border-l-2 transition-opacity ${
        isMetatagMode
          ? 'pointer-events-none select-none opacity-40 border-transparent'
          : rhymeGroup
            ? `${rhymeGroup.colorClass.split(' ')[0]} hover:bg-white/[0.025]`
            : 'border-transparent focus-within:border-orange-accent/70 hover:bg-white/[0.025]'
      }`}
    >
      {isMetatagMode ? (
        <div className="mt-2 p-0.5 text-gray-700 shrink-0">
          <Lock size={11} />
        </div>
      ) : (
        <div
          {...dragHandleProps}
          className="mt-1.5 cursor-grab active:cursor-grabbing p-0.5 text-gray-600 hover:text-orange-accent transition-colors touch-visible-hover shrink-0"
          title="Перетягнути рядок (або Alt+↑/↓)"
        >
          <MoreVertical size={14} />
        </div>
      )}

      <div className="relative flex-grow min-w-0">
        <div className="relative">
          {settings.showStressHighlight && !isMetatagMode && (
            <StressOverlay metrics={metrics} text={row.text} />
          )}
          <textarea
            ref={textareaRef}
            value={row.text}
            readOnly={isMetatagMode}
            tabIndex={isMetatagMode ? -1 : 0}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onClick={e => {
              if (isMetatagMode) return;
              handleTextareaClick(e);
              setIsRowExpanded(true);
              onFocusRow?.(row.id, false);
            }}
            onFocus={e => {
              if (isMetatagMode) {
                e.currentTarget.blur();
                return;
              }
              setIsRowExpanded(true);
              onFocusRow?.(row.id, false);
              handleMobileFocusScroll(e.currentTarget);
            }}
            placeholder="Рядок... (Enter — новий, Ctrl+Space — підбір рими, . + 2 пробіли — наголос)"
            rows={1}
            className={`w-full bg-transparent px-1.5 py-0.5 text-base sm:text-lg leading-snug outline-none resize-none overflow-hidden placeholder:text-gray-700/70 placeholder:text-xs ${
              settings.showStressHighlight && !isMetatagMode
                ? 'text-white/40 caret-orange-accent'
                : 'text-gray-200'
            }`}
            spellCheck={false}
          />
        </div>

        {/* Live Rhyme Suggestions Dropdown near caret when ΔS = 1..3 or Ctrl+Space */}
        {!isMetatagMode && isRowExpanded && anchorLineInfo && rhymeCandidates.length > 0 && (
          <RhymeSuggestionsDropdown
            anchorInfo={anchorLineInfo}
            deltaS={activeDeltaS}
            candidates={rhymeCandidates}
            selectedIndex={selectedRhymeIdx}
            insertWithAccent={insertWithAccent}
            excludeVerbs={excludeVerbs}
            queryTimeMs={rhymeQueryTimeMs}
            onSelectCandidate={handleInsertRhymeCandidate}
            onToggleInsertWithAccent={() => setInsertWithAccent(prev => !prev)}
            onToggleExcludeVerbs={() => setExcludeVerbs(prev => !prev)}
            onClose={() => {
              setRhymeCandidates([]);
              setIsRhymeDismissed(true);
              setManualRhymeTrigger(false);
            }}
          />
        )}

        {settings.showMetrics && metrics && !isMetatagMode && (
          <div className="px-1.5 pb-0.5 flex items-center justify-between gap-2">
            <div className="flex-grow min-w-0">
              <MetricsRow
                metrics={metrics}
                bpm={settings.bpm}
                rhymeGroup={rhymeGroup}
                isExpanded={isRowExpanded}
                onToggleExpand={() => setIsRowExpanded(prev => !prev)}
                onToggleSyllableStress={handleToggleSyllableStress}
              />
            </div>

            {/* Quick 1-click manual Rhyme Trigger button when an anchor exists */}
            {isRowExpanded && anchorLineInfo && rhymeCandidates.length === 0 && (
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => {
                  setIsRhymeDismissed(false);
                  setManualRhymeTrigger(true);
                  onFocusRow?.(row.id, true);
                }}
                className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-orange-accent/15 hover:bg-orange-accent/25 border border-orange-accent/40 text-orange-accent text-[9px] font-bold uppercase tracking-wider cursor-pointer transition-all"
                title={`Підібрати риму до «${anchorLineInfo.anchorWord}» (Ctrl+Space)`}
              >
                <Sparkles size={9} />
                <span>Рима (-{anchorLineInfo.rhymeSignature})</span>
              </button>
            )}
          </div>
        )}
      </div>

      {!isMetatagMode && (
        <button
          onClick={e => {
            e.stopPropagation();
            onDelete(row.id);
          }}
          className="mt-1 p-1 text-gray-600 hover:text-red-400 touch-visible-hover transition-opacity z-20 shrink-0 cursor-pointer"
          title="Видалити рядок"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  );
};

export default SongRow;

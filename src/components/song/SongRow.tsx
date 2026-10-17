import React, { useRef, useEffect } from 'react';
import { MoreVertical, Trash2, ArrowUp, ArrowDown, LayoutList } from 'lucide-react';
import { Row } from './types';
import { SongSettings } from '../../hooks/useSongSettings';
import { useProsody } from '../../hooks/useProsody';
import { VOWELS } from '../../utils/prosodyEngine';
import MetricsRow, { RhymeGroupBadge } from './MetricsRow';
import StressOverlay from './StressOverlay';

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
  autoFocusId?: string | null;
  onUpdate: (id: string, text: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onMove: (id: string, direction: 'up' | 'down') => void;
  onConvertToSection: (id: string) => void;
  onEnterRow?: (id: string, textAfterCursor: string, textBeforeCursor: string) => void;
  onBackspaceEmpty?: (id: string) => void;
  dragHandleProps?: any;
}

const WORD_CHAR_REGEX = /[a-zA-Zа-яА-ЯіїєґІЇЄҐ\u0301'’ʼ‘`]/;
const SECTION_PRESETS = ['[Куплет 1]', '[Куплет 2]', '[Пре-хорус]', '[Приспів]', '[Брідж]', '[Аутро]'];

const SongRow: React.FC<SongRowProps> = ({ 
  row,
  settings,
  rhymeGroup,
  sectionSummary,
  autoFocusId,
  onUpdate,
  onDelete,
  onMove,
  onEnterRow,
  onBackspaceEmpty,
  dragHandleProps 
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const sectionInputRef = useRef<HTMLInputElement>(null);
  const { metrics } = useProsody(row.text, settings);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [row.text]);

  useEffect(() => {
    if (autoFocusId === row.id) {
      if (row.isSection && sectionInputRef.current) {
        sectionInputRef.current.focus();
      } else if (textareaRef.current) {
        textareaRef.current.focus();
        const len = textareaRef.current.value.length;
        textareaRef.current.setSelectionRange(len, len);
      }
    }
  }, [autoFocusId, row.id, row.isSection]);

  const applyAccentAtCharIndex = (val: string, targetCharIndex: number) => {
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
    const val = e.target.value;
    const cursor = e.target.selectionStart;

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
    // Alt + Click on a vowel toggles stress directly in the text
    if (!e.altKey) return;
    const pos = e.currentTarget.selectionStart;
    if (pos === null) return;

    const val = row.text;
    // Check character at pos or pos - 1
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
    if (!metrics) return;

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

  const [isRowExpanded, setIsRowExpanded] = React.useState(false);
  const [isSectionExpanded, setIsSectionExpanded] = React.useState(false);

  const handleMobileFocusScroll = (el: HTMLElement | null) => {
    if (!el || typeof window === 'undefined') return;
    if (window.innerWidth < 768) {
      setTimeout(() => {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, 180);
    }
  };

  if (row.isSection) {
    return (
      <div
        onClick={() => setIsSectionExpanded(prev => !prev)}
        className="group relative py-1.5 px-2.5 sm:px-3 my-1 matte-card border-orange-accent/20 rounded-xl cursor-pointer select-none"
      >
        <div className="flex items-center gap-2">
          <div 
            {...dragHandleProps} 
            onClick={(e) => e.stopPropagation()}
            className="cursor-grab active:cursor-grabbing p-1 text-gray-500 hover:text-orange-accent transition-colors shrink-0"
          >
            <LayoutList size={14} />
          </div>
          <div className="h-px flex-grow bg-gradient-to-r from-transparent via-orange-accent/30 to-orange-accent/10 hidden sm:block" />
          <input
            ref={sectionInputRef}
            value={row.text}
            onClick={(e) => {
              e.stopPropagation();
              setIsSectionExpanded(prev => !prev);
            }}
            onChange={(e) => onUpdate(row.id, e.target.value)}
            onFocus={(e) => handleMobileFocusScroll(e.currentTarget)}
            className="bg-transparent text-orange-accent font-black uppercase tracking-[0.2em] text-center focus:outline-none min-w-[100px] flex-grow sm:flex-grow-0 drop-shadow-[0_0_12px_rgba(255,107,0,0.25)] text-xs sm:text-sm cursor-pointer"
            placeholder="[ПРИСПІВ]"
            spellCheck={false}
          />
          {!isSectionExpanded && sectionSummary && sectionSummary.lineCount > 0 && (
            <span className="text-[8px] uppercase tracking-wider text-gray-500 font-bold shrink-0">
              {sectionSummary.lineCount}р • {sectionSummary.avgSingability}%
            </span>
          )}
          <div className="h-px flex-grow bg-gradient-to-l from-transparent via-orange-accent/30 to-orange-accent/10 hidden sm:block" />

          <div
            onClick={(e) => e.stopPropagation()}
            className="touch-visible-hover transition-opacity flex gap-0.5 bg-matte-black/90 border border-white/10 rounded-lg px-1 py-0.5 shrink-0"
          >
            <button onClick={() => onMove(row.id, 'up')} className="p-1 text-gray-400 hover:text-white cursor-pointer" title="Alt+↑"><ArrowUp size={12} /></button>
            <button onClick={() => onMove(row.id, 'down')} className="p-1 text-gray-400 hover:text-white cursor-pointer" title="Alt+↓"><ArrowDown size={12} /></button>
            <button onClick={() => onDelete(row.id)} className="p-1 text-gray-400 hover:text-red-400 cursor-pointer"><Trash2 size={12} /></button>
          </div>
        </div>

        {/* Section Delta Summary + Quick Section Presets (Collapsed by default, toggled on click) */}
        {isSectionExpanded && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center justify-between gap-1.5 mt-1.5 pt-1.5 border-t border-white/5 px-1 sm:px-4 animate-in fade-in duration-150"
          >
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-0.5 sm:flex-wrap">
              {SECTION_PRESETS.map(preset => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onUpdate(row.id, preset)}
                  className={`shrink-0 text-[9px] px-2 py-0.5 rounded border transition-all cursor-pointer ${
                    row.text.trim().toLowerCase() === preset.toLowerCase()
                      ? 'bg-orange-accent/20 border-orange-accent/50 text-orange-accent font-bold shadow-[0_0_10px_rgba(255,107,0,0.15)]'
                      : 'bg-white/[0.03] border-white/5 text-gray-400 hover:text-gray-200 hover:border-white/15'
                  }`}
                >
                  {preset.replace(/[\[\]]/g, '')}
                </button>
              ))}
            </div>

            {sectionSummary && sectionSummary.lineCount > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-[8.5px] uppercase tracking-wider text-gray-400 font-bold bg-black/40 px-2 py-0.5 rounded-md border border-white/10 self-start sm:self-auto">
                <span>{sectionSummary.lineCount} рядк.</span>
                <span className="opacity-30">•</span>
                <span className="text-orange-accent/90" title="Складова структура рядків секції">
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
      </div>
    );
  }

  return (
    <div
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
          setIsRowExpanded(false);
        }
      }}
      className={`studio-row group relative py-0.5 px-1 sm:px-2 hover:bg-white/[0.025] rounded-lg flex items-start gap-1 sm:gap-1.5 border-l-2 ${
        rhymeGroup ? rhymeGroup.colorClass.split(' ')[0] : 'border-transparent focus-within:border-orange-accent/70'
      }`}
    >
      <div 
        {...dragHandleProps} 
        className="mt-1.5 cursor-grab active:cursor-grabbing p-0.5 text-gray-600 hover:text-orange-accent transition-colors touch-visible-hover shrink-0"
        title="Перетягнути рядок (або Alt+↑/↓)"
      >
        <MoreVertical size={14} />
      </div>

      <div className="relative flex-grow min-w-0">
        <div className="relative">
          {settings.showStressHighlight && <StressOverlay metrics={metrics} text={row.text} />}
          <textarea
            ref={textareaRef}
            value={row.text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onClick={(e) => {
              handleTextareaClick(e);
              setIsRowExpanded(true);
            }}
            onFocus={(e) => {
              setIsRowExpanded(true);
              handleMobileFocusScroll(e.currentTarget);
            }}
            placeholder="Рядок... (Enter — новий рядок, . + 2 пробіли або клік по складу — наголос)"
            rows={1}
            className={`w-full bg-transparent px-1.5 py-0.5 text-base sm:text-lg leading-snug outline-none resize-none overflow-hidden placeholder:text-gray-700/70 placeholder:text-xs ${
              settings.showStressHighlight ? 'text-white/40 caret-orange-accent' : 'text-gray-200'
            }`}
            spellCheck={false}
          />
        </div>

        {settings.showMetrics && metrics && (
          <div className="px-1.5 pb-0.5">
            <MetricsRow
              metrics={metrics}
              bpm={settings.bpm}
              rhymeGroup={rhymeGroup}
              isExpanded={isRowExpanded}
              onToggleExpand={() => setIsRowExpanded(prev => !prev)}
              onToggleSyllableStress={handleToggleSyllableStress}
            />
          </div>
        )}
      </div>

      <button 
        onClick={(e) => { e.stopPropagation(); onDelete(row.id); }}
        className="mt-1 p-1 text-gray-600 hover:text-red-400 touch-visible-hover transition-opacity z-20 shrink-0 cursor-pointer"
        title="Видалити рядок"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
};

export default SongRow;



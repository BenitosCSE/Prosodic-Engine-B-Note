import React from 'react';
import { Sparkles, AlertTriangle, Check, CornerDownLeft, X } from 'lucide-react';
import { AnchorLineInfo, RankedRhymeCandidate } from '../../utils/rhymeEngine';

interface RhymeSuggestionsDropdownProps {
  anchorInfo: AnchorLineInfo;
  deltaS: number;
  candidates: RankedRhymeCandidate[];
  selectedIndex: number;
  insertWithAccent: boolean;
  excludeVerbs: boolean;
  queryTimeMs: number;
  onSelectCandidate: (candidate: RankedRhymeCandidate) => void;
  onToggleInsertWithAccent: () => void;
  onToggleExcludeVerbs: () => void;
  onClose: () => void;
}

const JUNCTION_LABELS: Record<string, { text: string; colorClass: string }> = {
  sandhi: {
    text: 'Сандхі-зв’язок',
    colorClass: 'text-emerald-300 bg-emerald-500/15 border-emerald-400/30',
  },
  glide_smooth: {
    text: 'М’який глайд',
    colorClass: 'text-cyan-300 bg-cyan-500/15 border-cyan-400/30',
  },
  muta_cum_liquida: {
    text: 'Плавний стик',
    colorClass: 'text-sky-300 bg-sky-500/10 border-sky-400/25',
  },
  obstruent_clash: {
    text: 'Збіг шумних (Δ=0.36)',
    colorClass: 'text-amber-300 bg-amber-500/15 border-amber-400/40',
  },
  sonorant_to_obstruent: {
    text: 'Сонор→шумний',
    colorClass: 'text-gray-400 bg-white/5 border-white/10',
  },
  hiatus: {
    text: 'Зіяння голосних',
    colorClass: 'text-gray-400 bg-white/5 border-white/10',
  },
  neutral: {
    text: 'Чистий стик',
    colorClass: 'text-gray-400 bg-white/5 border-white/10',
  },
};

const RhymeSuggestionsDropdown: React.FC<RhymeSuggestionsDropdownProps> = ({
  anchorInfo,
  deltaS,
  candidates,
  selectedIndex,
  insertWithAccent,
  excludeVerbs,
  queryTimeMs,
  onSelectCandidate,
  onToggleInsertWithAccent,
  onToggleExcludeVerbs,
  onClose,
}) => {
  if (candidates.length === 0) return null;

  return (
    <div
      onMouseDown={e => {
        // Prevent textarea from losing focus when clicking inside dropdown
        e.preventDefault();
      }}
      className="mt-1 mb-1.5 rounded-xl bg-[#111319]/98 border border-orange-accent/45 shadow-[0_14px_38px_rgba(0,0,0,0.85),0_0_20px_rgba(255,107,0,0.14)] overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-100"
    >
      {/* Top Info & Filter Bar */}
      <div className="flex flex-wrap items-center justify-between gap-1.5 px-2.5 py-1.5 bg-black/60 border-b border-white/10 text-[10px]">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-orange-accent/20 border border-orange-accent/40 text-orange-accent font-extrabold uppercase tracking-wider">
            <Sparkles size={10} />
            <span>{anchorInfo.schemeRoleLabel}</span>
          </span>

          <span className="text-gray-400 truncate max-w-[180px] sm:max-w-[260px]">
            до <strong className="text-gray-200">«{anchorInfo.anchorWord || anchorInfo.rhymeSignature}»</strong>{' '}
            <span className="font-mono text-orange-accent/90">(-{anchorInfo.rhymeSignature})</span>
          </span>

          <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 font-mono text-cyan-300 font-bold">
            ΔS = {deltaS} скл (ціль {anchorInfo.targetSyllables})
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Toggle Insert with Acute Accent \u0301 */}
          <button
            type="button"
            onClick={onToggleInsertWithAccent}
            className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase transition-all cursor-pointer ${
              insertWithAccent
                ? 'bg-orange-accent/20 border-orange-accent/50 text-orange-accent'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-200'
            }`}
            title="Вставляти слово одразу з правильним знаком наголосу (U+0301)"
          >
            Наголос ´: {insertWithAccent ? 'ON' : 'OFF'}
          </button>

          {/* Toggle Exclude Verbal Rhymes */}
          <button
            type="button"
            onClick={onToggleExcludeVerbs}
            className={`px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase transition-all cursor-pointer ${
              excludeVerbs
                ? 'bg-violet-500/20 border-violet-400/50 text-violet-300'
                : 'bg-white/5 border-white/10 text-gray-400 hover:text-gray-200'
            }`}
            title="Відсіяти дієслівні рими (-ти, -ться, -ла, -ив)"
          >
            Без дієслів
          </button>

          <span className="hidden sm:inline text-[9px] font-mono text-gray-500">
            {queryTimeMs}мс
          </span>

          <button
            type="button"
            onClick={onClose}
            className="p-0.5 text-gray-500 hover:text-gray-200 cursor-pointer"
            title="Закрити (Esc)"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* Candidates List */}
      <div className="max-h-48 overflow-y-auto divide-y divide-white/[0.04] custom-scrollbar">
        {candidates.slice(0, 12).map((cand, idx) => {
          const isSelected = idx === selectedIndex;
          const jMeta = JUNCTION_LABELS[cand.junction.junctionType] || JUNCTION_LABELS.neutral;
          const displayWord = insertWithAccent ? cand.stressedWord : cand.word;

          return (
            <button
              key={`${cand.word}-${idx}`}
              type="button"
              onClick={() => onSelectCandidate(cand)}
              className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-orange-accent/20 text-white'
                  : 'hover:bg-white/[0.04] text-gray-300'
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`text-sm font-bold tracking-wide ${
                    isSelected ? 'text-orange-accent' : 'text-gray-100'
                  }`}
                >
                  {displayWord}
                </span>

                {/* Exact vs Assonance Badge */}
                <span
                  className={`px-1.5 py-0.2 rounded text-[8.5px] font-extrabold uppercase tracking-wider border ${
                    cand.matchType === 'exact'
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-400/30'
                      : 'bg-cyan-500/15 text-cyan-300 border-cyan-400/30'
                  }`}
                >
                  {cand.matchType === 'exact' ? 'Точна' : 'Асонанс'}
                </span>

                {/* Meter Match Badge */}
                <span
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border ${
                    cand.exactMeterMatch
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/30'
                      : 'bg-white/5 text-gray-400 border-white/10'
                  }`}
                  title={
                    cand.exactMeterMatch
                      ? 'Точне влучання в залишок складів ΔS'
                      : `Допуск ±${cand.meterDiff} скл`
                  }
                >
                  {cand.syllableCount} скл
                  {cand.exactMeterMatch && <Check size={9} />}
                </span>
              </div>

              {/* Biomechanical Junction & Tempo Indicators */}
              <div className="flex items-center gap-1.5 shrink-0">
                <span
                  className={`px-1.5 py-0.2 rounded text-[8.5px] font-semibold border ${jMeta.colorClass}`}
                >
                  {jMeta.text}
                </span>

                {cand.junction.warning ? (
                  <span
                    className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 text-[8.5px] font-mono font-bold"
                    title={
                      cand.junction.tempoOverload
                        ? `Просідання темпу: BPMmax ${cand.junction.projectedBpmMax} нижче безпечного порогу`
                        : 'Важкий стик приголосних (Δ = 0.36)'
                    }
                  >
                    <AlertTriangle size={9} />
                    <span>{Math.round(cand.junction.projectedBpmMax)} BPM</span>
                  </span>
                ) : (
                  <span className="text-[9px] font-mono text-gray-500 hidden sm:inline">
                    {Math.round(cand.singability)}% спів
                  </span>
                )}

                {isSelected && (
                  <span className="inline-flex items-center gap-0.5 text-[9px] font-mono text-orange-accent font-bold ml-1">
                    <CornerDownLeft size={10} />
                    <span>Enter</span>
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer Keyboard Hint */}
      <div className="px-2.5 py-1 bg-black/50 border-t border-white/5 flex items-center justify-between text-[9px] text-gray-500 font-mono">
        <span>↑/↓ вибір • Enter/Tab вставити • Esc закрити • Ctrl+Space виклик</span>
        <span>SQLite WAL Index (1.44M форм)</span>
      </div>
    </div>
  );
};

export default RhymeSuggestionsDropdown;

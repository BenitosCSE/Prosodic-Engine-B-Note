import React from 'react';
import { ProsodyMetrics } from '../../utils/prosodyEngine';

export interface RhymeGroupBadge {
  label: string;
  colorClass: string;
  matchType: 'exact' | 'assonance';
}

interface MetricsRowProps {
  metrics: ProsodyMetrics | null;
  bpm: number;
  rhymeGroup?: RhymeGroupBadge | null;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  onToggleSyllableStress?: (segmentIdx: number, syllableIdxInSegment: number) => void;
}

const MetricsRow: React.FC<MetricsRowProps> = ({
  metrics,
  bpm,
  rhymeGroup,
  isExpanded = false,
  onToggleExpand,
  onToggleSyllableStress
}) => {
  if (!metrics) return null;

  const isOverloaded = metrics.BPMmax > 0 && metrics.BPMmax < bpm * 0.9;

  // Build flat index tracker so we can render beat grid bars (|) and anacrusis divider (┆)
  let globalSylCursor = 0;

  return (
    <div className="flex flex-col gap-1 -mt-0.5 pt-0.5">
      <div
        onClick={onToggleExpand}
        className="flex flex-wrap items-center justify-between gap-1.5 text-[8px] sm:text-[9px] leading-none uppercase tracking-wider text-gray-500/85 font-bold cursor-pointer select-none"
        title="Клікніть, щоб показати/сховати розмір (Дольник) та розкладку складів"
      >
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-gray-300">{metrics.S} скл</span>
          {metrics.anacrusis > 0 && (
            <span
              className="text-[7.5px] sm:text-[8px] px-1 py-0.5 rounded bg-white/5 text-gray-400 border border-white/10 leading-none"
              title={`Затакт: ${metrics.anacrusis} скл. перед першою сильною долею`}
            >
              затакт +{metrics.anacrusis}
            </span>
          )}
          <span className="opacity-30">•</span>
          <span>співучість {Math.round(metrics.singability)}%</span>
          {metrics.rhymeSignature && (
            <>
              <span className="opacity-30">•</span>
              {rhymeGroup ? (
                <span
                  className={`px-1 py-0.5 rounded border text-[8px] font-black tracking-wider lowercase inline-flex items-center gap-0.5 leading-none ${rhymeGroup.colorClass}`}
                  title={
                    rhymeGroup.matchType === 'exact'
                      ? `Точна рима (група ${rhymeGroup.label}): -${metrics.rhymeSignature}`
                      : `Асонансна/неточна рима (група ${rhymeGroup.label}): -${metrics.rhymeSignature}`
                  }
                >
                  <span className="uppercase">{rhymeGroup.label}</span>
                  <span>-{metrics.rhymeSignature}</span>
                </span>
              ) : (
                <span className="text-gray-400 lowercase" title="Фонетична римова клаузула (без пари в секції)">
                  -{metrics.rhymeSignature}
                </span>
              )}
            </>
          )}

          {isExpanded && (
            <>
              <span className="opacity-30">•</span>
              <span className="text-orange-accent font-black px-1 py-0.5 rounded bg-orange-accent/10 border border-orange-accent/30 leading-none">
                {metrics.meterName}
              </span>
            </>
          )}
        </div>

        {isExpanded && (
          <div className="flex items-center gap-1.5 text-[8px] sm:text-[9px] leading-none">
            <span className={isOverloaded ? 'text-red-400 font-black' : ''}>
              BPM max {Math.round(metrics.BPMmax)}
            </span>
            <span className="opacity-30">•</span>
            <span className={metrics.A < 0.7 ? 'text-orange-accent' : 'text-emerald-400/80'}>
              точність {Math.round(metrics.A * 100)}%
            </span>
          </div>
        )}
      </div>

      {isExpanded && onToggleSyllableStress && metrics.S > 0 && (
        <div className="flex flex-wrap items-center gap-1 pt-0.5 animate-in fade-in duration-150">
          {metrics.segments.map((seg, segIdx) => {
            if (seg.type === 'separator') {
              if (seg.pauseWeight && seg.pauseWeight > 0) {
                return (
                  <span
                    key={segIdx}
                    className="text-[9px] text-orange-accent/50 font-mono px-0.5 select-none"
                    title="Цезура / інтонаційна пауза"
                  >
                    ‖
                  </span>
                );
              }
              return null;
            }

            return (
              <div
                key={segIdx}
                className="inline-flex items-center bg-white/[0.02] rounded px-1 py-0.5 gap-0.5 border border-white/5"
              >
                {seg.syllables.map((syl, sylIdx) => {
                  if (!syl.isWord) {
                    return (
                      <span key={sylIdx} className="text-[10px] text-gray-600 px-0.5">
                        {syl.text}
                      </span>
                    );
                  }

                  const flatIdx = globalSylCursor++;
                  const prevSyl = flatIdx > 0 ? metrics.syllables[flatIdx - 1] : null;
                  const showAnacrusisBoundary =
                    prevSyl && prevSyl.isAnacrusis && !syl.isAnacrusis;
                  const showBeatBoundary =
                    !showAnacrusisBoundary &&
                    prevSyl &&
                    !prevSyl.isAnacrusis &&
                    !syl.isAnacrusis &&
                    prevSyl.beatIndex !== undefined &&
                    syl.beatIndex !== undefined &&
                    prevSyl.beatIndex !== syl.beatIndex;

                  const cleanSyl = syl.text.replace(/\u0301/g, '');
                  const load = syl.articulatoryLoad ?? 0;
                  const isHeavyCluster = load >= 0.42;
                  const isModerateCluster = !isHeavyCluster && load >= 0.28;

                  let tooltip = 'Клікніть, щоб поставити/змінити наголос у слові';
                  if (syl.isAnacrusis) {
                    tooltip += ' • Склад затакту (перед сильною долею)';
                  } else if (syl.beatIndex !== undefined) {
                    tooltip += ` • Доля такту #${syl.beatIndex + 1}`;
                  }
                  if (isHeavyCluster) {
                    tooltip += ' • Важкий збіг приголосних (гальмує темп)';
                  } else if (isModerateCluster) {
                    tooltip += ' • Щільний стик приголосних';
                  }

                  return (
                    <React.Fragment key={sylIdx}>
                      {showAnacrusisBoundary && (
                        <span
                          className="text-[10px] text-orange-accent/70 font-mono px-0.5 select-none"
                          title="Межа затакту — початок першої сильної долі"
                        >
                          ┆
                        </span>
                      )}
                      {showBeatBoundary && (
                        <span
                          className="text-[9px] text-white/15 font-mono px-0.5 select-none"
                          title={`Доля такту #${(syl.beatIndex ?? 0) + 1}`}
                        >
                          |
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => onToggleSyllableStress(segIdx, sylIdx)}
                        title={tooltip}
                        className={`text-[10px] min-h-[22px] sm:min-h-0 px-1.5 py-0.5 rounded transition-colors cursor-pointer relative inline-flex items-center justify-center leading-none ${
                          syl.stressed
                            ? syl.misstress
                              ? 'bg-red-500/20 text-red-400 font-bold'
                              : 'bg-orange-accent/20 text-orange-accent font-bold'
                            : syl.isAnacrusis
                            ? 'text-gray-500/70 italic hover:text-gray-300 hover:bg-white/5 active:bg-white/10'
                            : 'text-gray-400 hover:text-gray-200 hover:bg-white/5 active:bg-white/10'
                        } ${
                          isHeavyCluster
                            ? 'border-b-2 border-red-400/80'
                            : isModerateCluster
                            ? 'border-b border-amber-400/60'
                            : ''
                        }`}
                      >
                        {cleanSyl}
                      </button>
                    </React.Fragment>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MetricsRow;



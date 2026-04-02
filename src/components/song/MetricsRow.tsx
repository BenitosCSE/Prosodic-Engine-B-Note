import React from 'react';
import { ProsodyMetrics } from '../../utils/prosodyEngine';

interface MetricsRowProps {
  metrics: ProsodyMetrics | null;
  bpm: number;
}

const MetricsRow: React.FC<MetricsRowProps> = ({ metrics, bpm }) => {
  if (!metrics) return null;

  const isOverloaded = metrics.BPMmax < bpm * 0.9;

  return (
    <div className="flex items-center justify-between gap-2 mt-0.5 text-[9px] uppercase tracking-wider text-gray-500/80 font-bold animate-in fade-in duration-150 border-t border-white/5 pt-1">
      <div className="flex items-center gap-2">
        <span>{metrics.S} скл</span>
        <span className="opacity-30">•</span>
        <span>співуваність {Math.round(metrics.singability)}%</span>
      </div>
      <div className="flex items-center gap-2">
        <span className={isOverloaded ? 'text-orange-accent' : ''}>
          BPM max {Math.round(metrics.BPMmax)}
        </span>
        <span className="opacity-30">•</span>
        <span>точність {Math.round(metrics.A * 100)}%</span>
      </div>
    </div>
  );
};

export default MetricsRow;

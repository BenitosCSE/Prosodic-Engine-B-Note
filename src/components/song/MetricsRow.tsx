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
    <div className="flex flex-wrap items-center gap-3 mt-1 text-[10px] uppercase tracking-wider text-gray-500 font-bold animate-in fade-in duration-150">
      <span>{metrics.S} скл</span>
      <span className="opacity-30">•</span>
      <span>співуваність {Math.round(metrics.singability)}%</span>
      <span className="opacity-30">•</span>
      <span className={isOverloaded ? 'text-orange-accent' : ''}>
        BPM max {Math.round(metrics.BPMmax)}
      </span>
      <span className="opacity-30">•</span>
      <span>точність {Math.round(metrics.A * 100)}%</span>
    </div>
  );
};

export default MetricsRow;

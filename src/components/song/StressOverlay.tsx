import React from 'react';
import { ProsodyMetrics, isVowel, splitGraphemes } from '../../utils/prosodyEngine';

interface StressOverlayProps {
  metrics: ProsodyMetrics | null;
  text: string;
}

const StressOverlay: React.FC<StressOverlayProps> = ({ metrics }) => {
  if (!metrics || !metrics.segments) return null;

  return (
    <div className="absolute inset-0 px-1.5 py-0.5 text-base sm:text-lg leading-snug pointer-events-none select-none whitespace-pre-wrap break-words">
      {metrics.segments.map((segment, sIdx) => (
        <span key={sIdx}>
          {segment.type === 'separator' ? (
            <span className="text-transparent">{segment.text}</span>
          ) : (
            segment.syllables.map((syllable, syIdx) => (
              <span key={syIdx} className="relative">
                {splitGraphemes(syllable.fullText).map((cluster, cIdx) => {
                  const vowel = isVowel(cluster);
                  let className = "text-transparent";

                  if (syllable.stressed && vowel) {
                    className = syllable.misstress
                      ? "text-red-500 underline decoration-red-500 decoration-2 underline-offset-4 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]"
                      : "text-orange-accent underline decoration-orange-accent decoration-2 underline-offset-4 drop-shadow-[0_0_8px_rgba(255,107,0,0.4)]";
                  }

                  return (
                    <span key={cIdx} className={`${className} transition-colors duration-150`}>
                      {cluster}
                    </span>
                  );
                })}
              </span>
            ))
          )}
        </span>
      ))}
    </div>
  );
};

export default StressOverlay;


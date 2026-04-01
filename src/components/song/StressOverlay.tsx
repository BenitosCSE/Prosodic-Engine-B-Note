import React from 'react';
import { ProsodyMetrics, isVowel } from '../../utils/prosodyEngine';

interface StressOverlayProps {
  metrics: ProsodyMetrics | null;
  text: string;
}

const StressOverlay: React.FC<StressOverlayProps> = ({ metrics, text }) => {
  if (!metrics || !metrics.segments) return null;

  return (
    <div className="absolute inset-0 p-4 text-lg leading-relaxed pointer-events-none select-none whitespace-pre-wrap break-words">
      {metrics.segments.map((segment, sIdx) => (
        <span key={sIdx}>
          {segment.type === 'separator' ? (
            <span className="text-transparent">{segment.text}</span>
          ) : (
            segment.syllables.map((syllable, syIdx) => (
              <span key={syIdx} className="relative inline-block">
                {[...syllable.fullText].map((char, cIdx) => {
                  const vowel = isVowel(char);
                  let className = "text-transparent";
                  
                  if (syllable.stressed && vowel) {
                    className = syllable.misstress 
                      ? "text-red-500 border-b-2 border-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.4)]" 
                      : "text-orange-accent border-b-2 border-orange-accent drop-shadow-[0_0_8px_rgba(255,107,0,0.4)]";
                  }

                  return (
                    <span key={cIdx} className={`${className} transition-all duration-200`}>
                      {char}
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

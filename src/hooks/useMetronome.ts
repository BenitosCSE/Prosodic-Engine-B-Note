import { useEffect, useRef, useState } from 'react';

export function useMetronome(bpm: number, beats: number, subdivisions: number, enabled: boolean) {
  const audioContext = useRef<AudioContext | null>(null);
  const nextTickTime = useRef<number>(0);
  const currentSubdivision = useRef<number>(0);
  const timerId = useRef<number | null>(null);
  const uiTimers = useRef<number[]>([]);
  const [activeBeat, setActiveBeat] = useState<number>(-1);

  useEffect(() => {
    const clearUiTimers = () => {
      uiTimers.current.forEach(id => clearTimeout(id));
      uiTimers.current = [];
    };

    if (enabled) {
      if (!audioContext.current) {
        audioContext.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      if (audioContext.current.state === 'suspended') {
        audioContext.current.resume();
      }

      const safeBpm = Math.max(40, Math.min(300, bpm || 120));
      const safeBeats = Math.max(1, beats || 4);
      const safeSubs = Math.max(1, subdivisions || 2);

      nextTickTime.current = audioContext.current.currentTime + 0.06;
      currentSubdivision.current = 0;

      const scheduler = () => {
        if (!audioContext.current) return;

        while (nextTickTime.current < audioContext.current.currentTime + 0.1) {
          const subIdx = currentSubdivision.current;
          const scheduledTime = nextTickTime.current;

          playTick(scheduledTime, subIdx, safeSubs);

          if (subIdx % safeSubs === 0) {
            const beatNumber = Math.floor(subIdx / safeSubs) % safeBeats;
            const delayMs = Math.max(0, (scheduledTime - audioContext.current.currentTime) * 1000);
            const uiTimer = window.setTimeout(() => {
              setActiveBeat(beatNumber);
            }, delayMs);
            uiTimers.current.push(uiTimer);
          }

          const secondsPerBeat = 60.0 / safeBpm;
          const secondsPerSubdivision = secondsPerBeat / safeSubs;

          nextTickTime.current += secondsPerSubdivision;
          currentSubdivision.current = (currentSubdivision.current + 1) % (safeBeats * safeSubs);
        }
        timerId.current = window.setTimeout(scheduler, 25);
      };

      scheduler();
    } else {
      if (timerId.current) {
        clearTimeout(timerId.current);
      }
      clearUiTimers();
      setActiveBeat(-1);
    }

    return () => {
      if (timerId.current) {
        clearTimeout(timerId.current);
      }
      clearUiTimers();
    };
  }, [enabled, bpm, beats, subdivisions]);

  const playTick = (time: number, subdivision: number, safeSubs: number) => {
    if (!audioContext.current) return;

    const ctx = audioContext.current;
    const osc = ctx.createOscillator();
    const envelope = ctx.createGain();

    const isFirstBeat = subdivision === 0;
    const isBeat = subdivision % safeSubs === 0;

    // Studio woodblock/click frequencies: high accent on downbeat (1), warm mid on beats (2,3,4), soft ghost tick on subdivisions
    osc.type = isBeat ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(isFirstBeat ? 1200 : isBeat ? 820 : 440, time);
    if (isBeat) {
      osc.frequency.exponentialRampToValueAtTime(isFirstBeat ? 600 : 410, time + 0.035);
    }

    const peakGain = isFirstBeat ? 0.38 : isBeat ? 0.24 : 0.06;
    envelope.gain.setValueAtTime(0.001, time);
    envelope.gain.linearRampToValueAtTime(peakGain, time + 0.003);
    envelope.gain.exponentialRampToValueAtTime(0.0008, time + 0.045);

    osc.connect(envelope);
    envelope.connect(ctx.destination);

    osc.start(time);
    osc.stop(time + 0.05);
  };

  return { activeBeat };
}


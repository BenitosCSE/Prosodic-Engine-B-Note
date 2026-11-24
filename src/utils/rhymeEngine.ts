import {
  ProsodyMetrics,
  OnsetClass,
  JunctionEvaluation,
  evaluateJunctionBiomechanics,
  analyzeTextCached,
  compareRhymeSignatures,
} from './prosodyEngine';
import { Row } from '../components/song/types';

export type StanzaRhymeScheme = 'ABAB' | 'AABB' | 'ABBA' | 'AAA' | 'AUTO';

export const RHYME_SCHEME_OPTIONS: { id: StanzaRhymeScheme; label: string; hint: string }[] = [
  { id: 'AUTO', label: 'Авто', hint: 'Автоматичний пошук опорного рядка у строфі' },
  { id: 'ABAB', label: 'АБАБ', hint: 'Перехресне римування (1↔3, 2↔4)' },
  { id: 'AABB', label: 'ААББ', hint: 'Суміжне (парне) римування (1↔2, 3↔4)' },
  { id: 'ABBA', label: 'АББА', hint: 'Кільцеве (охопне) римування (1↔4, 2↔3)' },
  { id: 'AAA', label: 'ААА', hint: 'Монорима / терцет (усі рядки строфи до 1-го)' },
];

export interface RawRhymeCandidate {
  word: string;
  stressedWord: string;
  rhymeSig: string;
  syllableCount: number;
  singability: number;
  onsetClass: OnsetClass;
  isVerb: boolean;
  freqTier: number;
  matchType: 'exact' | 'assonance';
}

export interface RankedRhymeCandidate extends RawRhymeCandidate {
  meterDiff: number; // |syllableCount - deltaS|
  exactMeterMatch: boolean;
  junction: JunctionEvaluation;
  totalRankScore: number;
}

export interface AnchorLineInfo {
  anchorRowId: string;
  anchorText: string;
  anchorWord: string;
  rhymeSignature: string;
  targetSyllables: number;
  schemeRoleLabel: string; // e.g. "АБАБ: рима до рядка #1"
}

let fastBrowserBuckets: Record<
  string,
  { w: string; sw: string; s: number; o: number; oc: string; v: number }[]
> | null = null;
let fastBucketsLoading: Promise<void> | null = null;

async function ensureFastBrowserBuckets(): Promise<void> {
  if (fastBrowserBuckets) return;
  if (fastBucketsLoading) return fastBucketsLoading;
  fastBucketsLoading = (async () => {
    try {
      const resp = await fetch('/rhymes-fast.json');
      if (resp.ok) {
        fastBrowserBuckets = await resp.json();
      }
    } catch {
      fastBrowserBuckets = {};
    }
  })();
  return fastBucketsLoading;
}

function decodeOnsetCode(oc: string): OnsetClass {
  if (oc === 'v') return 'vowel';
  if (oc === 'g') return 'glide';
  if (oc === 's') return 'sonorant';
  return 'obstruent';
}

function extractLastWord(text: string): string {
  const words = text
    .trim()
    .split(/[^a-zA-Zа-яА-ЯіїєґІЇЄҐ\u0301'’ʼ‘`]+/)
    .filter(Boolean);
  if (words.length === 0) return '';
  return words[words.length - 1].toLowerCase().replace(/\u0301/g, '').replace(/[’ʼ‘`]/g, "'");
}

/**
 * Resolves the anchor line for rhyme matching based on the active StanzaRhymeScheme.
 * Stanzas are delimited by section rows (`isSection`) or empty lyric rows.
 */
export function resolveStanzaAnchorLine(
  rows: Row[],
  currentRowId: string,
  scheme: StanzaRhymeScheme,
  bpm: number,
  beats: number,
  customDictionary: Record<string, number>,
  subdivisions: number = 4,
  forceManualTrigger: boolean = false
): AnchorLineInfo | null {
  const currentIdx = rows.findIndex(r => r.id === currentRowId);
  if (currentIdx === -1 || rows[currentIdx].isSection) return null;

  // Walk backwards to find the start of the current stanza
  let stanzaStartIdx = currentIdx;
  while (stanzaStartIdx > 0) {
    const prev = rows[stanzaStartIdx - 1];
    if (prev.isSection || (!prev.text.trim() && stanzaStartIdx - 1 !== currentIdx)) {
      break;
    }
    stanzaStartIdx--;
  }

  // Collect non-empty preceding lyric lines in this stanza up to currentIdx
  const stanzaLyricRows: { row: Row; stanzaPos: number; metrics: ProsodyMetrics }[] = [];
  let posCounter = 0;
  let currentStanzaPos = 0;

  for (let i = stanzaStartIdx; i <= currentIdx; i++) {
    const r = rows[i];
    if (r.isSection) continue;
    if (i === currentIdx) {
      currentStanzaPos = posCounter;
      break;
    }
    if (r.text.trim()) {
      const m = analyzeTextCached(r.text, bpm, beats, customDictionary, subdivisions);
      if (m.S > 0 && m.rhymeSignature) {
        stanzaLyricRows.push({ row: r, stanzaPos: posCounter, metrics: m });
        posCounter++;
      }
    }
  }

  if (stanzaLyricRows.length === 0) {
    return null;
  }

  const quatrainSlot = currentStanzaPos % 4;
  let targetOffsetBack: number | null = null;
  let roleLabel = '';

  if (scheme === 'ABAB') {
    // 0: A, 1: B, 2: A (pairs with 0 -> 2 back), 3: B (pairs with 1 -> 2 back)
    if (quatrainSlot === 2 && stanzaLyricRows.length >= 2) {
      targetOffsetBack = 2;
      roleLabel = 'АБАБ (3↔1)';
    } else if (quatrainSlot === 3 && stanzaLyricRows.length >= 2) {
      targetOffsetBack = 2;
      roleLabel = 'АБАБ (4↔2)';
    } else if (forceManualTrigger) {
      targetOffsetBack = stanzaLyricRows.length >= 2 ? 2 : 1;
      roleLabel = 'АБАБ';
    }
  } else if (scheme === 'AABB') {
    // 0: A, 1: A (pairs with 0 -> 1 back), 2: B, 3: B (pairs with 2 -> 1 back)
    if (quatrainSlot === 1 || quatrainSlot === 3 || forceManualTrigger) {
      targetOffsetBack = 1;
      roleLabel = quatrainSlot === 3 ? 'ААББ (4↔3)' : 'ААББ (2↔1)';
    }
  } else if (scheme === 'ABBA') {
    // 0: A, 1: B, 2: B (pairs with 1 -> 1 back), 3: A (pairs with 0 -> 3 back)
    if (quatrainSlot === 2) {
      targetOffsetBack = 1;
      roleLabel = 'АББА (3↔2)';
    } else if (quatrainSlot === 3 && stanzaLyricRows.length >= 3) {
      targetOffsetBack = 3;
      roleLabel = 'АББА (4↔1)';
    } else if (forceManualTrigger) {
      targetOffsetBack = 1;
      roleLabel = 'АББА';
    }
  } else if (scheme === 'AAA') {
    // All lines in stanza rhyme with the first line of the stanza
    const anchor = stanzaLyricRows[0];
    return {
      anchorRowId: anchor.row.id,
      anchorText: anchor.row.text,
      anchorWord: extractLastWord(anchor.row.text),
      rhymeSignature: anchor.metrics.rhymeSignature,
      targetSyllables: anchor.metrics.S,
      schemeRoleLabel: 'ААА (до 1-го)',
    };
  } else {
    // 'AUTO': Find nearest unrhymed preceding line in stanza
    const lastIdx = stanzaLyricRows.length - 1;
    if (lastIdx >= 1) {
      const prev1 = stanzaLyricRows[lastIdx];
      const prev2 = stanzaLyricRows[lastIdx - 1];
      const alreadyPaired = compareRhymeSignatures(
        prev1.metrics.rhymeSignature,
        prev2.metrics.rhymeSignature
      );
      if (alreadyPaired) {
        // Previous two lines already form an AA pair; if there's an unclosed line before them or we start a new pair:
        if (lastIdx >= 2) {
          const prev3 = stanzaLyricRows[lastIdx - 2];
          if (!compareRhymeSignatures(prev3.metrics.rhymeSignature, prev2.metrics.rhymeSignature)) {
            targetOffsetBack = 3; // ABBA closure!
            roleLabel = 'Авто (кільце 4↔1)';
          }
        }
      }
    }
    if (targetOffsetBack === null) {
      // Check if 2 lines back is unrhymed (ABAB pattern) or 1 line back (AABB)
      if (stanzaLyricRows.length >= 2) {
        const last = stanzaLyricRows[stanzaLyricRows.length - 1];
        const twoBack = stanzaLyricRows[stanzaLyricRows.length - 2];
        const pair12 = compareRhymeSignatures(
          last.metrics.rhymeSignature,
          twoBack.metrics.rhymeSignature
        );
        if (!pair12 && quatrainSlot >= 2) {
          targetOffsetBack = 2;
          roleLabel = 'Авто (перехресна)';
        } else {
          targetOffsetBack = 1;
          roleLabel = 'Авто (суміжна)';
        }
      } else {
        targetOffsetBack = 1;
        roleLabel = 'Авто (до попереднього)';
      }
    }
  }

  if (targetOffsetBack === null) return null;
  const anchorIdx = stanzaLyricRows.length - targetOffsetBack;
  if (anchorIdx < 0 || anchorIdx >= stanzaLyricRows.length) return null;

  const anchor = stanzaLyricRows[anchorIdx];
  const fallbackTargetS = Math.max(4, Math.round((beats * 60 * 3.0) / Math.max(60, bpm)));

  return {
    anchorRowId: anchor.row.id,
    anchorText: anchor.row.text,
    anchorWord: extractLastWord(anchor.row.text),
    rhymeSignature: anchor.metrics.rhymeSignature,
    targetSyllables: anchor.metrics.S > 0 ? anchor.metrics.S : fallbackTargetS,
    schemeRoleLabel: roleLabel,
  };
}

/**
 * Fetches and ranks top rhyme candidates for a given anchor rhyme signature,
 * remaining syllables ΔS, and current line prefix biomechanics.
 */
export async function queryAndRankRhymes(params: {
  rhymeSignature: string;
  anchorWord: string;
  deltaS: number;
  linePrefixText: string;
  prefixWordFilter?: string;
  currentLineMetrics: ProsodyMetrics | null;
  bpm: number;
  beats: number;
  excludeVerbs?: boolean;
}): Promise<{ candidates: RankedRhymeCandidate[]; queryTimeMs: number }> {
  const {
    rhymeSignature,
    anchorWord,
    deltaS,
    linePrefixText,
    prefixWordFilter = '',
    currentLineMetrics,
    bpm,
    beats,
    excludeVerbs = false,
  } = params;

  const t0 = performance.now();
  const cleanAnchor = anchorWord.toLowerCase().replace(/[\u0301'’ʼ‘`]/g, '').trim();
  const cleanPrefixFilter = prefixWordFilter.toLowerCase().replace(/[\u0301'’ʼ‘`]/g, '').trim();
  const clampedDeltaS = Math.max(1, Math.min(6, deltaS));

  let rawCandidates: RawRhymeCandidate[] = [];

  // 1. Try sub-millisecond SQLite backend (/api/rhymes)
  try {
    const qs = new URLSearchParams({
      sig: rhymeSignature,
      deltaS: String(clampedDeltaS),
      anchorWord: cleanAnchor,
      excludeVerbs: excludeVerbs ? '1' : '0',
    });
    const resp = await fetch(`/api/rhymes?${qs.toString()}`);
    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data.candidates) && data.candidates.length > 0) {
        rawCandidates = data.candidates;
      }
    }
  } catch {
    // Offline fallback below
  }

  // 2. Fallback or supplement from fast in-browser rhyme index (/rhymes-fast.json)
  if (rawCandidates.length < 8) {
    await ensureFastBrowserBuckets();
    if (fastBrowserBuckets) {
      const normSig = rhymeSignature
        .toLowerCase()
        .replace(/я/g, 'а')
        .replace(/ю/g, 'у')
        .replace(/є/g, 'е')
        .replace(/ї/g, 'і')
        .replace(/[\u0301'’ʼ‘`ь]/g, '');

      const exactList = fastBrowserBuckets[normSig] || [];
      const seen = new Set(rawCandidates.map(c => c.word));

      exactList.forEach(item => {
        if (item.w === cleanAnchor || seen.has(item.w)) return;
        if (excludeVerbs && item.v === 1) return;
        if (Math.abs(item.s - clampedDeltaS) <= 2) {
          seen.add(item.w);
          rawCandidates.push({
            word: item.w,
            stressedWord: item.sw,
            rhymeSig: normSig,
            syllableCount: item.s,
            singability: item.o,
            onsetClass: decodeOnsetCode(item.oc),
            isVerb: item.v === 1,
            freqTier: 1,
            matchType: 'exact',
          });
        }
      });

      // Also scan assonance buckets if still under 12
      if (rawCandidates.length < 12) {
        for (const [bSig, list] of Object.entries(fastBrowserBuckets)) {
          if (bSig === normSig) continue;
          const mType = compareRhymeSignatures(normSig, bSig);
          if (mType === 'assonance') {
            for (const item of list) {
              if (item.w === cleanAnchor || seen.has(item.w)) continue;
              if (excludeVerbs && item.v === 1) continue;
              if (Math.abs(item.s - clampedDeltaS) <= 1) {
                seen.add(item.w);
                rawCandidates.push({
                  word: item.w,
                  stressedWord: item.sw,
                  rhymeSig: bSig,
                  syllableCount: item.s,
                  singability: item.o,
                  onsetClass: decodeOnsetCode(item.oc),
                  isVerb: item.v === 1,
                  freqTier: 1,
                  matchType: 'assonance',
                });
              }
            }
          }
          if (rawCandidates.length >= 30) break;
        }
      }
    }
  }

  // Filter by partial word prefix if user has started typing the last word
  if (cleanPrefixFilter.length > 0) {
    const filtered = rawCandidates.filter(c => c.word.startsWith(cleanPrefixFilter));
    if (filtered.length > 0) {
      rawCandidates = filtered;
    }
  }

  // 3. Multi-Criteria Biomechanical Ranking
  const ranked: RankedRhymeCandidate[] = rawCandidates.map(cand => {
    const meterDiff = Math.abs(cand.syllableCount - clampedDeltaS);
    const exactMeterMatch = meterDiff === 0;
    const junction = evaluateJunctionBiomechanics(
      linePrefixText,
      cand.onsetClass,
      cand.syllableCount,
      cand.singability,
      currentLineMetrics,
      bpm,
      beats
    );

    // Priority hierarchy:
    // 1. Rhyme quality: exact (+1000) vs assonance (+400)
    // 2. Meter accuracy: exact ΔS (+350), ΔS ± 1 (+150)
    // 3. Biomechanical safety & junction score (no clash / no tempo overload +180)
    // 4. Lexical tier (tier 1 +60, tier 2 +30)
    let totalRankScore =
      (cand.matchType === 'exact' ? 1000 : 400) +
      (exactMeterMatch ? 350 : Math.max(0, 200 - meterDiff * 110)) +
      (junction.warning ? -220 : 180) +
      junction.biomechanicalScore +
      (3 - Math.min(3, cand.freqTier)) * 30;

    return {
      ...cand,
      meterDiff,
      exactMeterMatch,
      junction,
      totalRankScore: Math.round(totalRankScore * 10) / 10,
    };
  });

  ranked.sort((a, b) => b.totalRankScore - a.totalRankScore);

  const queryTimeMs = Math.round((performance.now() - t0) * 100) / 100;
  return {
    candidates: ranked.slice(0, 25),
    queryTimeMs,
  };
}

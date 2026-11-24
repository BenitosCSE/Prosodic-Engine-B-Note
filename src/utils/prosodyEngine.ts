import globalDictionary from './dictionary.json';
import { ExtendedStressDB, getCachedStressDB, saveCachedStressDB } from '../db';

let extendedStressDB: ExtendedStressDB | null = null;
let loadingPromise: Promise<ExtendedStressDB | null> | null = null;

// Zero-Copy Binary Stress Diff Buffer (loaded from /stress-diff.bin without JSON.parse)
let binaryDiffView: DataView | null = null;
let binaryDiffCount = 0;
let binaryCollisions: Record<string, number> = {};
let binaryLoadingPromise: Promise<boolean> | null = null;

// Incremental Dirty-Line Metrics Cache (O(1) reuse for unchanged lines)
const MAX_LINE_CACHE_SIZE = 2500;
const lineMetricsCache = new Map<string, ProsodyMetrics>();
let cachedDictRef: Record<string, number> | null = null;
let cachedDictVersion = 0;

export function clearProsodyLineCache(): void {
  lineMetricsCache.clear();
}

const utf8Encoder = new TextEncoder();

/**
 * Deterministic 64-bit FNV-1a hash over UTF-8 bytes of a normalized word.
 * Matches Python `fnv1a_64` bit-for-bit.
 */
export function fnv1a64(word: string): bigint {
  const bytes = utf8Encoder.encode(word);
  let h = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  const mask = 0xffffffffffffffffn;
  for (let i = 0; i < bytes.length; i++) {
    h ^= BigInt(bytes[i]);
    h = (h * prime) & mask;
  }
  return h;
}

/**
 * Zero-Copy O(log N) binary search over /stress-diff.bin (9-byte records: <QB).
 */
export function lookupBinaryStressDiff(
  cleanWord: string
): { primary: number; isHomograph: boolean } | null {
  if (!binaryDiffView || binaryDiffCount <= 0) return null;

  if (binaryCollisions[cleanWord] !== undefined) {
    const sb = binaryCollisions[cleanWord];
    return { primary: sb & 0x3f, isHomograph: Boolean(sb & 0x80) };
  }

  const target = fnv1a64(cleanWord);
  let lo = 0;
  let hi = binaryDiffCount - 1;
  const view = binaryDiffView;
  const HEADER_SIZE = 12;
  const RECORD_SIZE = 9;

  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    const offset = HEADER_SIZE + mid * RECORD_SIZE;
    const h = view.getBigUint64(offset, true);
    if (h === target) {
      const sb = view.getUint8(offset + 8);
      return { primary: sb & 0x3f, isHomograph: Boolean(sb & 0x80) };
    } else if (h < target) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return null;
}

/**
 * Loads the Zero-Copy binary diff dictionary (/stress-diff.bin) as an ArrayBuffer/DataView.
 */
export async function ensureBinaryStressDiff(): Promise<boolean> {
  if (binaryDiffView) return true;
  if (binaryLoadingPromise) return binaryLoadingPromise;

  binaryLoadingPromise = (async () => {
    try {
      const [binResp, metaResp] = await Promise.all([
        fetch('/stress-diff.bin'),
        fetch('/stress-diff-meta.json').catch(() => null),
      ]);
      if (binResp.ok) {
        const buf = await binResp.arrayBuffer();
        if (buf.byteLength >= 12) {
          const view = new DataView(buf);
          // Check magic "BNSD" (0x44534e42 little-endian)
          const m0 = view.getUint8(0);
          const m1 = view.getUint8(1);
          const m2 = view.getUint8(2);
          const m3 = view.getUint8(3);
          if (m0 === 0x42 && m1 === 0x4e && m2 === 0x53 && m3 === 0x44) {
            binaryDiffCount = view.getUint32(8, true);
            binaryDiffView = view;
            if (metaResp && metaResp.ok) {
              const meta = await metaResp.json();
              binaryCollisions = meta.collisions || {};
            }
            lineMetricsCache.clear();
            return true;
          }
        }
      }
    } catch (e) {
      // Fallback to morphological rules + bootstrap dictionary
    }
    return false;
  })();

  return binaryLoadingPromise;
}

const ENDINGS_SET = new Set([
  "уватися", "юватися", "увалися", "ювалися", "уватиме", "юватиме",
  "ований", "ованого", "ованому", "ованим", "ованім", "ована", "ованої", "ованій", "овану", "ованою", "оване", "овані", "ованих", "ованими",
  "ений", "еного", "еному", "еним", "енім", "ена", "еної", "еній", "ену", "еною", "ене", "ені", "ених", "еними",
  "ський", "ського", "ському", "ським", "ськім", "ська", "ської", "ській", "ську", "ською", "ське", "ські", "ських", "ськими",
  "цький", "цького", "цькому", "цьким", "цькім", "цька", "цької", "цькій", "цьку", "цькою", "цьке", "цькі", "цьких", "цькими",
  "зький", "зького", "зькому", "зьким", "зькім", "зька", "зької", "зькій", "зьку", "зькою", "зьке", "зькі", "зьких", "зькими",
  "ність", "ності", "ністю", "ностей", "ностям", "ностями", "ностях",
  "ування", "ювання", "уванням", "юванням", "уваннях", "юваннях",
  "ання", "яння", "анню", "янню", "анням", "янням", "аннями", "яннями",
  "ення", "єння", "енню", "єнню", "енням", "єнням", "еннями", "єннями",
  "итися", "ітися", "атися", "ятися", "утися", "ютися", "еться", "ється", "яться", "уться", "ються", "имось",
  "ами", "ями", "ові", "еві", "єві", "ими", "їми", "ого", "ього", "ому", "ьому",
  "емо", "ємо", "ете", "єте", "уть", "ють", "ать", "ять", "имо", "їмо", "ите", "їте",
  "ою", "єю", "их", "їх", "им", "їм", "ий", "ій", "ая", "яя", "еє", "єє", "ії",
  "ів", "їв", "ах", "ях", "ом", "ем", "єм", "ам", "ям", "ши", "вши", "чи",
  "ти", "ть", "ла", "ло", "ли", "иш", "їш", "ся", "сь",
  "а", "я", "о", "е", "є", "и", "і", "ї", "у", "ю", "в"
]);

export async function ensureExtendedStressDB(): Promise<ExtendedStressDB | null> {
  // Prioritize Zero-Copy Binary Diff Index first
  await ensureBinaryStressDiff();
  if (extendedStressDB) return extendedStressDB;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const cached = await getCachedStressDB();
      if (cached && cached.version === 2) {
        extendedStressDB = cached;
        lineMetricsCache.clear();
        return cached;
      }
      const response = await fetch('/stress-db.json');
      if (response.ok) {
        const data: ExtendedStressDB = await response.json();
        extendedStressDB = data;
        lineMetricsCache.clear();
        await saveCachedStressDB(data);
        return data;
      }
    } catch (e) {
      console.warn('Extended stress DB fallback to binary/bootstrap dictionary:', e);
    }
    return null;
  })();

  return loadingPromise;
}

export const VOWELS = new Set(["а", "е", "є", "и", "і", "ї", "о", "у", "ю", "я", "a", "e", "i", "o", "u", "y"]);
export const CONSONANTS = new Set(["б", "в", "г", "ґ", "д", "ж", "з", "й", "к", "л", "м", "н", "п", "р", "с", "т", "ф", "х", "ц", "ч", "ш", "щ", "b", "c", "d", "f", "g", "h", "j", "k", "l", "m", "n", "p", "q", "r", "s", "t", "v", "w", "x", "z"]);
const SONORANTS = new Set(["р", "л", "м", "н", "й", "в", "r", "l", "m", "n", "w", "j"]);
const GLIDES = new Set(["в", "й", "w", "j", "ў"]);
const PLOSIVES = new Set(["п", "б", "т", "д", "к", "ґ", "p", "b", "t", "d", "k", "g"]);
const SIBILANTS = new Set(["ж", "ч", "ш", "щ", "ц", "з", "с", "s", "z", "x"]);
const OPEN_RESONANT_VOWELS = new Set(["а", "я", "о", "a", "o"]);
const FAST_NARROW_VOWELS = new Set(["і", "ї", "и", "у", "ю", "i", "u", "y"]);
const IOTATED = new Set(["я", "ю", "є"]);
const APOSTROPHES = new Set(["'", "’", "ʼ", "‘", "`"]);

// Fix #1: Explicit Ukrainian monosyllabic functional clitics set
// Short content words (зло, дно, гра, сто, три, два, свій) are NOT in this set and preserve stress!
export const CLITICS_SET = new Set([
  "і", "й", "а", "та", "як", "що", "не", "ні", "бо", "чи", "то",
  "за", "на", "по", "до", "зі", "у", "в", "з", "із", "би", "б",
  "же", "ж", "від", "під", "над"
]);

const Kh = 0.25;
const Gh = 0.15;
const Xh = 0.1;
const Zh = 6;
// Fix #3: Smooth asymptotic cluster damping coefficient (replaces linear 1 - 1.4*load + hard 0.5 floor)
export const K_CLUSTER_DECAY = 1.85;

export type OnsetClass = 'vowel' | 'glide' | 'sonorant' | 'obstruent';

export interface Syllable {
  text: string;
  fullText: string;
  isWord: boolean;
  closed: boolean;
  glideClosed?: boolean;     // True if closed only by vocalized glide [ў] or [і̯]
  opennessScore?: number;    // 1.0 = open (or sandhi-linked), 0.85 = glide-closed ([ў]/[і̯]), 0.0 = obstruent-closed
  articulatoryLoad?: number; // Biomechanical consonant transition load
  vowelCode?: string;        // Core vowel of the syllable
  consonants: number;
  stressed: boolean;
  misstress: boolean;
  isAnacrusis?: boolean;     // Pickup syllable before first strong beat
  beatIndex?: number;
  subdivisionIndex?: number;
  candidateLineStressIndices?: number[];
}

export interface Segment {
  type: 'word' | 'separator';
  text: string;
  syllables: Syllable[];
  pauseWeight?: number;
}

export interface ProsodyMetrics {
  S: number;             // Syllable count
  S_eff: number;         // Effective syllable count (including pauses & phonetic weights)
  O: number;             // Acoustic openness (0..1, accounting for glides & cross-word sandhi)
  Cavg: number;          // Average phonetic consonants per syllable
  SD: number;            // Syllable density per beat
  r: number;             // Articulation rate (syllables/sec)
  rMax: number;          // Max recommended rate (smooth asymptotic curve)
  BPMmax: number;        // Max recommended BPM
  A: number;             // Stress-to-grid accuracy (0..1)
  singability: number;   // 0-100
  complexity: number;    // 0-100
  meterName: string;     // Detected poetic/rap meter (Ямб, Хорей, Дактиль, Амфібрахій, Анапест, Дольник)
  scheme: string;        // Visual stress pattern (e.g. "— ∪ — ∪")
  rhymeSignature: string;// Phonetic clause from the last stressed vowel for rhyme matching
  anacrusis: number;     // Number of pickup syllables before first strong downbeat
  pauseCount: number;    // Number of caesuras/pauses in the line
  segments: Segment[];
  syllables: Syllable[];
}

export function isVowel(char: string): boolean {
  if (!char) return false;
  return VOWELS.has(char[0].toLowerCase());
}

export function isSectionMarker(text: string): boolean {
  const t = text.trim();
  return t.length > 2 && t.startsWith("[") && t.endsWith("]");
}

/**
 * Classifies the initial phoneme of a word for cross-word junction biomechanics.
 */
export function classifyWordOnset(wordClean: string): OnsetClass {
  const w = wordClean.toLowerCase().replace(/[\u0301'’ʼ‘`ь]/g, '').trim();
  if (!w) return 'vowel';
  const first = w[0];
  if (IOTATED.has(first) || first === 'ї' || GLIDES.has(first)) {
    return 'glide';
  }
  if (VOWELS.has(first)) {
    return 'vowel';
  }
  if (SONORANTS.has(first)) {
    return 'sonorant';
  }
  return 'obstruent';
}

export interface JunctionEvaluation {
  junctionType: 'sandhi' | 'glide_smooth' | 'muta_cum_liquida' | 'sonorant_to_obstruent' | 'obstruent_clash' | 'hiatus' | 'neutral';
  junctionDelta: number;
  projectedBpmMax: number;
  tempoOverload: boolean;
  hasClash: boolean;
  warning: boolean;
  biomechanicalScore: number; // Higher is smoother
}

/**
 * Evaluates biomechanical transition at the word boundary between the current line prefix
 * and a candidate rhyme word, plus projects whether BPM > BPM_max * 0.9.
 */
export function evaluateJunctionBiomechanics(
  linePrefixText: string,
  candidateOnset: OnsetClass,
  candidateSyllables: number,
  candidateSingability: number,
  currentMetrics: ProsodyMetrics | null,
  bpm: number,
  beats: number
): JunctionEvaluation {
  const cleanPrefix = linePrefixText.toLowerCase().replace(/[\u0301'’ʼ‘`ь]/g, '').trim();
  const lastChar = cleanPrefix.length > 0 ? cleanPrefix[cleanPrefix.length - 1] : '';

  let junctionDelta = 0.0;
  let junctionType: JunctionEvaluation['junctionType'] = 'neutral';

  if (!lastChar || !CONSONANTS.has(lastChar)) {
    // Prefix ends in an open vowel
    if (candidateOnset === 'glide') {
      junctionDelta = -0.06;
      junctionType = 'glide_smooth';
    } else if (candidateOnset === 'vowel') {
      junctionDelta = 0.05;
      junctionType = 'hiatus';
    }
  } else {
    // Prefix ends in a consonant
    const prevIsObstruent = PLOSIVES.has(lastChar) || SIBILANTS.has(lastChar);
    if (candidateOnset === 'vowel') {
      // Cross-word Sandhi: closed coda resyllabifies into candidate's vowel onset
      junctionDelta = -0.15;
      junctionType = 'sandhi';
    } else if (candidateOnset === 'glide' || candidateOnset === 'sonorant') {
      junctionDelta = prevIsObstruent ? 0.12 : 0.08;
      junctionType = 'muta_cum_liquida';
    } else if (candidateOnset === 'obstruent') {
      if (prevIsObstruent) {
        // Heavy obstruent clash (Δ = 0.36)
        junctionDelta = 0.36;
        junctionType = 'obstruent_clash';
      } else {
        junctionDelta = 0.18;
        junctionType = 'sonorant_to_obstruent';
      }
    }
  }

  const curS = currentMetrics?.S ?? 0;
  const curSEff = currentMetrics?.S_eff ?? 0;
  const curO = currentMetrics?.O ?? 0.65;
  const curClusterSum = currentMetrics
    ? currentMetrics.syllables.reduce((acc, s) => acc + (s.articulatoryLoad ?? 0), 0)
    : 0;

  const candS = Math.max(1, candidateSyllables);
  const candO = Math.max(0, Math.min(1, candidateSingability / 100));
  const candSEff = candS * (1.1 + (1 - candO) * 0.25);

  const totalS = Math.max(1, curS + candS);
  const totalSEff = Math.max(0.5, curSEff + candSEff + Math.max(0, junctionDelta));
  const totalO = Math.min(
    1,
    (curO * curS + candO * candS + (junctionType === 'sandhi' ? 0.35 : 0)) / totalS
  );
  const avgCluster = (curClusterSum + Math.max(0, junctionDelta)) / totalS;

  const rMax = (Zh / (1.0 + K_CLUSTER_DECAY * avgCluster)) * (1.0 + 0.25 * (totalO - 0.5));
  const safeBeats = Math.max(1, beats);
  const projectedBpmMax = (rMax * 60 * safeBeats) / totalSEff;

  const tempoOverload = bpm > projectedBpmMax * 0.9;
  const hasClash = junctionType === 'obstruent_clash';
  const warning = hasClash || tempoOverload;

  // Biomechanical score: reward sandhi & glide transitions, penalize clashes & tempo overload
  let biomechanicalScore = 50 - junctionDelta * 100 + candO * 20;
  if (junctionType === 'sandhi') biomechanicalScore += 18;
  if (junctionType === 'glide_smooth') biomechanicalScore += 12;
  if (hasClash) biomechanicalScore -= 45;
  if (tempoOverload) biomechanicalScore -= 35;

  return {
    junctionType,
    junctionDelta: Math.round(junctionDelta * 1000) / 1000,
    projectedBpmMax: Math.round(projectedBpmMax * 10) / 10,
    tempoOverload,
    hasClash,
    warning,
    biomechanicalScore: Math.round(biomechanicalScore * 10) / 10,
  };
}

/**
 * Splits a string into grapheme clusters where U+0301 stays attached to its base character.
 */
export function splitGraphemes(str: string): string[] {
  const graphemes: string[] = [];
  for (let i = 0; i < str.length; i++) {
    let cluster = str[i];
    while (i + 1 < str.length && str[i + 1] === '\u0301') {
      cluster += '\u0301';
      i++;
    }
    graphemes.push(cluster);
  }
  return graphemes;
}

/**
 * Level 1 G2P: Normalizes silent consonant clusters & assimilations in Ukrainian words/syllables
 * so orthographic "dead letters" do not inflate consonant counts or articulatory penalties.
 */
export function normalizeUkrainianPhonetics(strLower: string): string {
  return strLower
    .replace(/\u0301/g, '')
    .replace(/ться/g, 'ця')
    .replace(/шся/g, 'ся')
    .replace(/стн/g, 'сн')
    .replace(/здн/g, 'зн')
    .replace(/стл/g, 'сл')
    .replace(/нтськ/g, 'нськ')
    .replace(/стськ/g, 'ськ')
    .replace(/рдц/g, 'рц')
    .replace(/лнц/g, 'нц');
}

/**
 * Extracts phonetic sequence of consonants in a syllable and calculates both:
 * 1) Phonetic consonant count
 * 2) Biomechanical articulatory transition load (Level 2: muta cum liquida vs obstruent clash)
 */
export function analyzeSyllablePhonetics(
  sylLower: string,
  prevCharBeforeSyl?: string
): { count: number; articulatoryLoad: number; vowelChar: string } {
  const normalized = normalizeUkrainianPhonetics(sylLower);
  const phones: string[] = [];
  let vowelChar = 'а';

  for (let i = 0; i < normalized.length; i++) {
    const ch = normalized[i];
    if (VOWELS.has(ch)) {
      vowelChar = ch;
    }
    if (ch === 'щ') {
      phones.push('ш', 'ч');
    } else if (ch === 'ї') {
      phones.push('й');
    } else if (IOTATED.has(ch)) {
      const prev = i === 0 ? prevCharBeforeSyl : normalized[i - 1];
      if (!prev || VOWELS.has(prev) || APOSTROPHES.has(prev) || prev === 'ь') {
        phones.push('й');
      }
    } else if (CONSONANTS.has(ch)) {
      if (ch === 'д' && (normalized[i + 1] === 'ж' || normalized[i + 1] === 'з')) {
        phones.push(ch + normalized[i + 1]);
        i++;
      } else {
        phones.push(ch);
      }
    }
  }

  const count = phones.length;
  if (count === 0) {
    return { count: 0, articulatoryLoad: 0, vowelChar };
  }

  let articulatoryLoad = 0;
  for (let i = 1; i < phones.length; i++) {
    const prev = phones[i - 1];
    const curr = phones[i];

    const prevIsObstruent = PLOSIVES.has(prev) || SIBILANTS.has(prev) || prev === 'дж' || prev === 'дз';
    const currIsSonorant = SONORANTS.has(curr) || GLIDES.has(curr);
    const prevIsSonorant = SONORANTS.has(prev) || GLIDES.has(prev);
    const currIsObstruent = PLOSIVES.has(curr) || SIBILANTS.has(curr) || curr === 'дж' || curr === 'дз';

    if (prevIsObstruent && currIsSonorant) {
      articulatoryLoad += 0.12;
    } else if (prevIsSonorant && currIsObstruent) {
      articulatoryLoad += 0.18;
    } else if (prevIsObstruent && currIsObstruent) {
      articulatoryLoad += 0.36;
    } else {
      articulatoryLoad += Kh;
    }
  }

  return { count, articulatoryLoad, vowelChar };
}

export function countPhoneticConsonants(sylLower: string, prevCharBeforeSyl?: string): number {
  return analyzeSyllablePhonetics(sylLower, prevCharBeforeSyl).count;
}

export function evaluateSyllableClosure(sylLower: string): {
  closed: boolean;
  glideClosed: boolean;
  opennessScore: number;
} {
  const clean = sylLower.replace(/[\u0301'’ʼ‘`ь]/g, '');
  if (!clean) return { closed: false, glideClosed: false, opennessScore: 1.0 };

  const lastChar = clean[clean.length - 1];
  if (!CONSONANTS.has(lastChar)) {
    return { closed: false, glideClosed: false, opennessScore: 1.0 };
  }

  if (GLIDES.has(lastChar)) {
    return { closed: false, glideClosed: true, opennessScore: 0.85 };
  }

  if (SONORANTS.has(lastChar)) {
    return { closed: true, glideClosed: false, opennessScore: 0.35 };
  }

  return { closed: true, glideClosed: false, opennessScore: 0.0 };
}

export function isSyllableClosed(sylLower: string): boolean {
  return evaluateSyllableClosure(sylLower).closed;
}

export function stripUkrainianEnding(word: string): string {
  const n = word.length;
  const maxK = Math.min(7, n - 3);
  for (let k = maxK; k >= 1; k--) {
    if (ENDINGS_SET.has(word.slice(n - k))) {
      const stem = word.slice(0, n - k);
      for (let i = 0; i < stem.length; i++) {
        if (VOWELS.has(stem[i])) {
          return stem;
        }
      }
    }
  }
  return word;
}

/**
 * Multi-tier Ukrainian stress lookup:
 * 1. User custom dictionary
 * 2. Zero-Copy Binary Stress Diff Index (/stress-diff.bin via DataView O(log N))
 * 3. Extended NASU database (if loaded)
 * 4. Synchronous bootstrap dictionary (9,169 words)
 * 5. Morphological heuristic fallback (`detectStress`)
 */
export function lookupWordStress(
  cleanWord: string,
  totalVowels: number,
  customDictionary: Record<string, number> = {}
): { primary: number; candidates?: number[] } {
  if (totalVowels <= 1) return { primary: 0 };

  // 1. User custom dictionary (highest priority after manual \u0301)
  if (customDictionary[cleanWord] !== undefined) {
    const idx = Math.max(0, Math.min(totalVowels - 1, customDictionary[cleanWord]));
    return { primary: idx };
  }

  // 2. Zero-Copy Binary Stress Diff Index (O(log N) over ArrayBuffer DataView)
  if (binaryDiffView) {
    const binHit = lookupBinaryStressDiff(cleanWord);
    if (binHit !== null) {
      const primary = Math.max(0, Math.min(totalVowels - 1, binHit.primary));
      if (binHit.isHomograph && extendedStressDB?.multi[cleanWord]) {
        const valid = extendedStressDB.multi[cleanWord].filter(i => i >= 0 && i < totalVowels);
        return { primary, candidates: valid.length > 1 ? valid : undefined };
      }
      return { primary };
    }
  }

  // 3. Extended NASU database (if loaded in memory)
  if (extendedStressDB) {
    const multi = extendedStressDB.multi[cleanWord];
    if (multi && multi.length > 0) {
      const valid = multi.filter(i => i >= 0 && i < totalVowels);
      if (valid.length > 0) {
        return { primary: valid[0], candidates: valid.length > 1 ? valid : undefined };
      }
    }

    const exact = extendedStressDB.exact[cleanWord];
    if (exact !== undefined) {
      return { primary: Math.max(0, Math.min(totalVowels - 1, exact)) };
    }

    const stem = stripUkrainianEnding(cleanWord);
    const stemStress = extendedStressDB.stems[stem];
    if (stemStress !== undefined) {
      return { primary: Math.max(0, Math.min(totalVowels - 1, stemStress)) };
    }

    const nvCap = Math.min(totalVowels, 7);
    if (cleanWord.length >= 4) {
      const s4Hit = extendedStressDB.s4[`${nvCap}:${cleanWord.slice(-4)}`];
      if (s4Hit !== undefined && s4Hit < totalVowels) {
        return { primary: s4Hit };
      }
    }
    if (cleanWord.length >= 3) {
      const s3Hit = extendedStressDB.s3[`${nvCap}:${cleanWord.slice(-3)}`];
      if (s3Hit !== undefined && s3Hit < totalVowels) {
        return { primary: s3Hit };
      }
    }
  }

  // 4. Synchronous bootstrap dictionary (9,169 high-frequency short words)
  if ((globalDictionary as Record<string, number>)[cleanWord] !== undefined) {
    const idx = (globalDictionary as Record<string, number>)[cleanWord];
    return { primary: Math.max(0, Math.min(totalVowels - 1, idx)) };
  }

  // 5. Morphological fallback
  return { primary: detectStress(cleanWord) };
}

/**
 * Morphologically enhanced Ukrainian stress heuristic (Core v2.5).
 * Fix #2: Narrowed final-stress verbal endings so disyllabic verbs like ма́ла, гра́ла, ста́вив
 * retain root stress (0) instead of being pushed to n - 1.
 */
export function detectStress(word: string): number {
  const wordLower = word.toLowerCase().replace(/[\u0301'’ʼ‘`]/g, '');
  const vowelIndices: number[] = [];
  for (let i = 0; i < wordLower.length; i++) {
    if (VOWELS.has(wordLower[i])) vowelIndices.push(i);
  }

  const n = vowelIndices.length;
  if (n <= 1) return 0;

  // 1. Prefix "ви-" in verbs/nouns pulls stress to the first syllable (e.g., ви́їхав, ви́бір)
  if (
    wordLower.startsWith('ви') &&
    n >= 2 &&
    (wordLower.endsWith('ти') ||
      wordLower.endsWith('в') ||
      wordLower.endsWith('ла') ||
      wordLower.endsWith('ло') ||
      wordLower.endsWith('ли'))
  ) {
    return 0;
  }

  // 2. Strictly oxytone verbal & nominal endings (-имо, -ете, -узь, -тя/-ття except -ання)
  if (
    wordLower.endsWith('имо') ||
    wordLower.endsWith('ете') ||
    wordLower.endsWith('узь') ||
    (!wordLower.endsWith('ання') && (wordLower.endsWith('тя') || wordLower.endsWith('ття')))
  ) {
    return n - 1;
  }

  // 3. Past tense verbs (-ла, -ло, -ли, -ив, -ов), verbal nouns (-ння, -ість, -увати) & adjectives (-ський):
  // Penultimate stress Math.max(0, n - 2) -> gives 0 for disyllabic forms (ма́ла, гра́ла, ста́вив)
  // and n - 2 for polysyllabic forms (чита́ла, говори́в, розумі́ння).
  if (
    wordLower.endsWith('ла') ||
    wordLower.endsWith('ло') ||
    wordLower.endsWith('ли') ||
    wordLower.endsWith('ив') ||
    wordLower.endsWith('ов') ||
    wordLower.endsWith('ння') ||
    wordLower.endsWith('ість') ||
    wordLower.endsWith('увати') ||
    wordLower.endsWith('ювати') ||
    wordLower.endsWith('ський') ||
    wordLower.endsWith('цький') ||
    wordLower.endsWith('зький') ||
    wordLower.endsWith('ська') ||
    wordLower.endsWith('цька') ||
    wordLower.endsWith('зька')
  ) {
    return Math.max(0, n - 2);
  }

  // 4. Standard Ukrainian statistical distribution
  if (n === 2) return 0;
  if (n === 3) return 1;

  return Math.max(0, n - 2);
}

/**
 * Level 2 Biomechanical Weight: Combines stress duration, articulatory transition load,
 * coda closure vs glide vocalization, and intrinsic vowel speed.
 */
export function getSyllableWeight(syllable: Syllable): number {
  if (!syllable.isWord) return 0;

  const openness = syllable.opennessScore ?? (syllable.closed ? 0 : 1);
  const closedWeight = 1 - openness;
  const openWeight = openness;

  const stressWeight = (syllable.stressed && !syllable.misstress) ? 1.45 : 1.0;
  const clusterLoad = syllable.articulatoryLoad !== undefined
    ? syllable.articulatoryLoad
    : Math.max(0, Kh * (syllable.consonants - 1));

  const vowelSpeedMod = syllable.vowelCode && FAST_NARROW_VOWELS.has(syllable.vowelCode) ? -0.05 : 0;

  const weight = stressWeight + clusterLoad + Gh * closedWeight - Xh * openWeight + vowelSpeedMod;
  return Math.max(0.5, weight);
}

/**
 * Detects classical poetic / rap meter and generates visual scheme.
 */
function detectMeterAndScheme(syllables: Syllable[]): { meterName: string; scheme: string } {
  const n = syllables.length;
  if (n === 0) return { meterName: '—', scheme: '' };

  const pattern = syllables.map(s => (s.stressed ? 1 : 0));
  const scheme = pattern.map(p => (p === 1 ? '—' : '∪')).join(' ');

  if (n < 2) {
    return { meterName: 'Односклад', scheme };
  }

  const stressedIndices = pattern.map((v, i) => (v === 1 ? i : -1)).filter(i => i !== -1);
  if (stressedIndices.length === 0) {
    return { meterName: 'Пірихій', scheme };
  }

  const meters = [
    { name: 'Хорей', period: 2, offset: 0 },
    { name: 'Ямб', period: 2, offset: 1 },
    { name: 'Дактиль', period: 3, offset: 0 },
    { name: 'Амфібрахій', period: 3, offset: 1 },
    { name: 'Анапест', period: 3, offset: 2 },
  ];

  let bestMeter = 'Дольник';
  let bestScore = 0;

  for (const m of meters) {
    const hits = stressedIndices.filter(idx => idx % m.period === m.offset).length;
    const score = hits / stressedIndices.length;
    if (score > bestScore && score >= 0.65) {
      bestScore = score;
      bestMeter = m.name;
    }
  }

  return { meterName: bestMeter, scheme };
}

/**
 * Extracts phonetic rhyme signature (assonant + consonant tail from last stressed syllable).
 */
export function extractRhymeSignature(syllables: Syllable[]): string {
  if (syllables.length === 0) return '';
  let lastStressedIdx = -1;
  for (let i = syllables.length - 1; i >= 0; i--) {
    if (syllables[i].stressed) {
      lastStressedIdx = i;
      break;
    }
  }
  if (lastStressedIdx === -1) lastStressedIdx = syllables.length - 1;

  const rawTail = syllables
    .slice(lastStressedIdx)
    .map(s => s.text)
    .join('')
    .replace(/[\u0301'’ʼ‘`ь]/g, '');

  const tailText = normalizeUkrainianPhonetics(rawTail);

  for (let i = 0; i < tailText.length; i++) {
    if (VOWELS.has(tailText[i])) {
      const coreMap: Record<string, string> = { 'я': 'а', 'ю': 'у', 'є': 'е', 'ї': 'і' };
      const firstVowel = coreMap[tailText[i]] || tailText[i];
      return firstVowel + tailText.slice(i + 1);
    }
  }
  return tailText;
}

const DEFAULT_EMPTY_DICT: Record<string, number> = {};

/**
 * Incremental Dirty-Line Cached wrapper around `analyzeText`.
 * Reuses previously computed ProsodyMetrics in O(1) for unchanged lines.
 */
export function analyzeTextCached(
  text: string,
  bpm: number,
  beats: number,
  dictionary: Record<string, number> = DEFAULT_EMPTY_DICT,
  subdivisions: number = 4
): ProsodyMetrics {
  let dictVer = 0;
  if (dictionary !== DEFAULT_EMPTY_DICT && dictionary !== cachedDictRef) {
    const keys = Object.keys(dictionary);
    if (keys.length > 0) {
      cachedDictRef = dictionary;
      cachedDictVersion++;
      dictVer = cachedDictVersion;
    }
  } else if (dictionary === cachedDictRef) {
    dictVer = cachedDictVersion;
  }
  const dbFlag = (binaryDiffView ? 2 : 0) | (extendedStressDB ? 1 : 0);
  const cacheKey = `${bpm}:${beats}:${subdivisions}:${dictVer}:${dbFlag}::${text}`;
  const existing = lineMetricsCache.get(cacheKey);
  if (existing) {
    return existing;
  }

  const computed = analyzeText(text, bpm, beats, dictionary, subdivisions);
  if (lineMetricsCache.size >= MAX_LINE_CACHE_SIZE) {
    const oldestKey = lineMetricsCache.keys().next().value;
    if (oldestKey !== undefined) {
      lineMetricsCache.delete(oldestKey);
    }
  }
  lineMetricsCache.set(cacheKey, computed);
  return computed;
}

export function analyzeText(
  text: string,
  bpm: number,
  beats: number,
  dictionary: Record<string, number> = {},
  subdivisions: number = 4
): ProsodyMetrics {
  const segments: Segment[] = [];
  const allSyllables: Syllable[] = [];
  let pauseCount = 0;
  let totalPauseWeight = 0;

  const tokenRegex = /([^a-zA-Zа-яА-ЯіїєґІЇЄҐ\u0301'’ʼ‘`]+)/;
  const parts = text.split(tokenRegex);

  let pendingConsonantsFromProclitic = 0;
  let pendingLoadFromProclitic = 0;
  let lastSeparatorHadPause = false;

  parts.forEach(part => {
    if (!part) return;

    const hasLetters = /[a-zA-Zа-яА-ЯіїєґІЇЄҐ]/.test(part);

    if (!hasLetters) {
      let pauseWeight = 0;
      if (/[—–…]|\.\.\./.test(part)) {
        pauseWeight = 0.5;
        pauseCount++;
      } else if (/[,;:!?]/.test(part)) {
        pauseWeight = 0.25;
        pauseCount++;
      }
      totalPauseWeight += pauseWeight;
      lastSeparatorHadPause = pauseWeight > 0;

      segments.push({
        type: 'separator',
        text: part,
        pauseWeight,
        syllables: [{
          text: part,
          fullText: part,
          isWord: false,
          closed: false,
          consonants: 0,
          stressed: false,
          misstress: false
        }]
      });
    } else {
      const syllables: Syllable[] = [];
      const graphemes = splitGraphemes(part);

      // 1. Locate vowels in grapheme clusters and detect manual \u0301 stress
      let stressIndex: number | undefined = undefined;
      const vowelGraphemeIndices: number[] = [];

      graphemes.forEach((g, idx) => {
        const baseChar = g[0].toLowerCase();
        if (VOWELS.has(baseChar)) {
          if (g.includes('\u0301')) {
            stressIndex = vowelGraphemeIndices.length;
          }
          vowelGraphemeIndices.push(idx);
        }
      });

      const cleanWord = part.toLowerCase().replace(/\u0301/g, '').replace(/[’ʼ‘`]/g, "'");
      let wordCandidateStresses: number[] | undefined = undefined;

      // 2. Multi-tier Dictionary & Zero-Copy Binary Diff lookup (if no manual \u0301 in text)
      if (stressIndex === undefined && vowelGraphemeIndices.length > 0) {
        const lookup = lookupWordStress(cleanWord, vowelGraphemeIndices.length, dictionary);
        stressIndex = lookup.primary;
        wordCandidateStresses = lookup.candidates;
      }

      if (stressIndex !== undefined && vowelGraphemeIndices.length > 0) {
        stressIndex = Math.max(0, Math.min(vowelGraphemeIndices.length - 1, stressIndex));
      }

      // Handle vowelless words (Ukrainian proclitics/enclitics like "в", "з", "ж", "б")
      if (vowelGraphemeIndices.length === 0) {
        const { count: consCount } = analyzeSyllablePhonetics(cleanWord);
        if (allSyllables.length > 0 && (cleanWord === 'ж' || cleanWord === 'б')) {
          const prevSyl = allSyllables[allSyllables.length - 1];
          prevSyl.consonants += consCount;
          prevSyl.articulatoryLoad = (prevSyl.articulatoryLoad ?? 0) + 0.18;
          prevSyl.closed = true;
          prevSyl.opennessScore = 0.0;
        } else {
          pendingConsonantsFromProclitic += consCount;
          pendingLoadFromProclitic += 0.12;
        }

        syllables.push({
          text: part.toLowerCase(),
          fullText: part,
          isWord: false,
          closed: false,
          consonants: consCount,
          stressed: false,
          misstress: false
        });
        segments.push({ type: 'word', text: part, syllables });
        return;
      }

      // 4. Level 1 Cross-Word Resyllabification (Sandhi)
      const startsWithVowelSound = VOWELS.has(graphemes[0][0].toLowerCase()) && pendingConsonantsFromProclitic === 0;
      if (startsWithVowelSound && !lastSeparatorHadPause && allSyllables.length > 0) {
        const prevSyl = allSyllables[allSyllables.length - 1];
        if (prevSyl.closed || prevSyl.glideClosed) {
          prevSyl.closed = false;
          prevSyl.glideClosed = false;
          prevSyl.opennessScore = 0.95;
        }
      }

      const firstCharLower = graphemes[0][0].toLowerCase();
      const secondCharLower = graphemes.length > 1 ? graphemes[1][0].toLowerCase() : '';
      let initialVGlideTransferred = false;
      if (
        firstCharLower === 'в' &&
        CONSONANTS.has(secondCharLower) &&
        !lastSeparatorHadPause &&
        allSyllables.length > 0 &&
        !allSyllables[allSyllables.length - 1].closed
      ) {
        const prevSyl = allSyllables[allSyllables.length - 1];
        prevSyl.glideClosed = true;
        prevSyl.opennessScore = 0.85;
        initialVGlideTransferred = true;
      }

      // 5. True Ukrainian Phonetic Syllabification across grapheme clusters
      let startGrapheme = 0;
      const totalVowels = vowelGraphemeIndices.length;

      for (let vIdx = 0; vIdx < totalVowels; vIdx++) {
        const currentVowelPos = vowelGraphemeIndices[vIdx];
        let endGrapheme: number;

        if (vIdx === totalVowels - 1) {
          endGrapheme = graphemes.length;
        } else {
          const nextVowelPos = vowelGraphemeIndices[vIdx + 1];
          const interocalicCount = nextVowelPos - currentVowelPos - 1;

          if (interocalicCount <= 1) {
            endGrapheme = currentVowelPos + 1;
          } else {
            const firstAfterVowel = graphemes[currentVowelPos + 1][0].toLowerCase();
            const secondAfterVowel = currentVowelPos + 2 < graphemes.length ? graphemes[currentVowelPos + 2][0].toLowerCase() : '';

            if (firstAfterVowel === 'д' && (secondAfterVowel === 'ж' || secondAfterVowel === 'з') && interocalicCount === 2) {
              endGrapheme = currentVowelPos + 1;
            } else if (SONORANTS.has(firstAfterVowel) || firstAfterVowel === 'ь' || APOSTROPHES.has(firstAfterVowel)) {
              endGrapheme = currentVowelPos + 2;
              if (secondAfterVowel === 'ь' || APOSTROPHES.has(secondAfterVowel)) {
                endGrapheme = Math.min(nextVowelPos, currentVowelPos + 3);
              }
            } else {
              endGrapheme = interocalicCount >= 3 ? currentVowelPos + 2 : currentVowelPos + 1;
            }
          }
        }

        const sylGraphemes = graphemes.slice(startGrapheme, endGrapheme);
        const sylFullText = sylGraphemes.join('');
        const sylLower = sylFullText.toLowerCase();
        const prevChar = startGrapheme > 0 ? graphemes[startGrapheme - 1][0].toLowerCase() : undefined;

        const phonetics = analyzeSyllablePhonetics(sylLower, prevChar);
        let consonantsCount = phonetics.count;
        let articulatoryLoad = phonetics.articulatoryLoad;

        if (vIdx === 0 && initialVGlideTransferred && consonantsCount > 1) {
          consonantsCount -= 1;
          articulatoryLoad = Math.max(0, articulatoryLoad - 0.15);
        }

        if (vIdx === 0 && pendingConsonantsFromProclitic > 0) {
          consonantsCount += pendingConsonantsFromProclitic;
          articulatoryLoad += pendingLoadFromProclitic;
          pendingConsonantsFromProclitic = 0;
          pendingLoadFromProclitic = 0;
        }

        const closure = evaluateSyllableClosure(sylLower);
        const hasManualAccent = sylFullText.includes('\u0301');

        // Fix #1: Explicit Ukrainian functional clitics check instead of naive open-monosyllable length check
        const isClitic =
          totalVowels === 1 &&
          !hasManualAccent &&
          CLITICS_SET.has(cleanWord);
        const isStressed = !isClitic && stressIndex === vIdx;
        const wordBaseLineIdx = allSyllables.length - vIdx;
        const candidateLineStressIndices =
          !isClitic && wordCandidateStresses && wordCandidateStresses.length > 1
            ? wordCandidateStresses.map(cIdx => wordBaseLineIdx + cIdx)
            : undefined;

        const sylObj: Syllable = {
          text: sylLower,
          fullText: sylFullText,
          isWord: true,
          closed: closure.closed,
          glideClosed: closure.glideClosed,
          opennessScore: closure.opennessScore,
          articulatoryLoad,
          vowelCode: phonetics.vowelChar,
          consonants: consonantsCount,
          stressed: isStressed,
          misstress: false,
          candidateLineStressIndices
        };

        syllables.push(sylObj);
        allSyllables.push(sylObj);
        startGrapheme = endGrapheme;
      }

      lastSeparatorHadPause = false;
      segments.push({ type: 'word', text: part, syllables });
    }
  });

  const S = allSyllables.length;
  const safeBeats = Math.max(1, beats);
  const safeSubs = Math.max(1, subdivisions);
  let detectedAnacrusis = 0;

  // Level 3: Stress-Anchored Grid with Anacrusis (Pickup) Detection & P-Center Isochrony
  if (S > 0) {
    const stressedIndices = allSyllables
      .map((s, idx) => (s.stressed ? idx : -1))
      .filter(idx => idx !== -1);

    const firstStressIdx = stressedIndices.length > 0 ? stressedIndices[0] : 0;
    const candidateOffsets = [0];
    if (firstStressIdx === 1) candidateOffsets.push(1);
    if (firstStressIdx === 2) candidateOffsets.push(1, 2);

    let bestStrongSet = new Set<number>();
    let bestHitScore = -1;
    let bestOffset = 0;

    for (const anacrusisOffset of candidateOffsets) {
      const effectiveS = Math.max(1, S - anacrusisOffset);
      const candidateSet = new Set<number>();

      if (effectiveS <= safeBeats) {
        for (let b = 0; b < safeBeats; b++) {
          const idx = anacrusisOffset + Math.min(effectiveS - 1, Math.round((b * effectiveS) / safeBeats));
          candidateSet.add(idx);
        }
      } else {
        for (let b = 0; b < safeBeats; b++) {
          const beatAnchor = anacrusisOffset + Math.round((b * effectiveS) / safeBeats);
          if (beatAnchor < S) candidateSet.add(beatAnchor);

          if (effectiveS >= safeBeats * 1.5 && safeSubs >= 2) {
            const subAnchor = anacrusisOffset + Math.round(((b + 0.5) * effectiveS) / safeBeats);
            if (subAnchor < S) candidateSet.add(subAnchor);
          }
        }
      }

      const hits = stressedIndices.filter(idx => candidateSet.has(idx)).length;
      const score = stressedIndices.length > 0 ? hits / stressedIndices.length : 1;

      if (score > bestHitScore) {
        bestHitScore = score;
        bestStrongSet = candidateSet;
        bestOffset = anacrusisOffset;
      }
    }

    detectedAnacrusis = bestOffset;

    for (let i = 0; i < S; i++) {
      const syl = allSyllables[i];
      if (syl.stressed && syl.candidateLineStressIndices && !bestStrongSet.has(i)) {
        const beatAlignedIdx = syl.candidateLineStressIndices.find(cIdx => bestStrongSet.has(cIdx));
        if (beatAlignedIdx !== undefined && allSyllables[beatAlignedIdx]) {
          syl.stressed = false;
          allSyllables[beatAlignedIdx].stressed = true;
        }
      }
    }

    const updatedStressedIndices = allSyllables
      .map((s, idx) => (s.stressed ? idx : -1))
      .filter(idx => idx !== -1);

    let isIsochronousChain = false;
    if (updatedStressedIndices.length >= 2) {
      const intervals: number[] = [];
      for (let k = 1; k < updatedStressedIndices.length; k++) {
        intervals.push(updatedStressedIndices[k] - updatedStressedIndices[k - 1]);
      }
      const regularIntervals = intervals.filter(d => d === 2 || d === 3 || d === 4).length;
      if (regularIntervals / intervals.length >= 0.75) {
        isIsochronousChain = true;
      }
    }

    const { meterName } = detectMeterAndScheme(allSyllables);
    const hasRegularMeter =
      isIsochronousChain ||
      (meterName !== 'Дольник' && meterName !== '—' && meterName !== 'Пірихій');

    const effectiveS = Math.max(1, S - bestOffset);
    allSyllables.forEach((s, i) => {
      s.isAnacrusis = i < bestOffset;
      const shiftedIdx = Math.max(0, i - bestOffset);
      const exactBeatPos = (shiftedIdx * safeBeats) / effectiveS;
      s.beatIndex = Math.floor(exactBeatPos) % safeBeats;
      s.subdivisionIndex = Math.floor((exactBeatPos * safeSubs) % safeSubs);

      const isOnGridBeat = bestStrongSet.has(i);
      if (s.stressed && !isOnGridBeat && !hasRegularMeter) {
        s.misstress = true;
      }
    });
  }

  const S_eff = allSyllables.reduce((acc, s) => acc + getSyllableWeight(s), 0) + totalPauseWeight;

  const totalOpenness = allSyllables.reduce((acc, s) => {
    const baseOpen = s.opennessScore ?? (s.closed ? 0 : 1);
    const resonanceBonus = s.vowelCode && OPEN_RESONANT_VOWELS.has(s.vowelCode) ? 0.08 : 0;
    return acc + Math.min(1, baseOpen + resonanceBonus);
  }, 0);

  const totalConsonants = allSyllables.reduce((acc, s) => acc + s.consonants, 0);

  const O = S > 0 ? totalOpenness / S : 0;
  const Cavg = S > 0 ? totalConsonants / S : 0;
  const SD = safeBeats > 0 ? S_eff / safeBeats : 0;
  const r = safeBeats > 0 ? (S_eff * bpm) / (60 * safeBeats) : 0;

  // Fix #3: Smooth asymptotic decay for rMax without hard 0.5 plateau or negative collapse
  const avgClusterLoad = S > 0
    ? allSyllables.reduce((acc, s) => acc + (s.articulatoryLoad ?? 0), 0) / S
    : 0;

  const rMax = (Zh / (1.0 + K_CLUSTER_DECAY * avgClusterLoad)) * (1.0 + 0.25 * (O - 0.5));

  const BPMmax = S_eff > 0 ? (rMax * 60 * safeBeats) / S_eff : 0;
  const singability = Math.min(100, Math.max(0, O * 100));
  const complexity = Math.min(100, Math.max(0, (Cavg / 2.5) * 100));

  const stressedSyllables = allSyllables.filter(s => s.stressed);
  const correctStressCount = stressedSyllables.filter(s => !s.misstress).length;
  const A = stressedSyllables.length > 0 ? correctStressCount / stressedSyllables.length : 1;

  const { meterName, scheme } = detectMeterAndScheme(allSyllables);
  const rhymeSignature = extractRhymeSignature(allSyllables);

  return {
    S,
    S_eff,
    O,
    Cavg,
    SD,
    r,
    rMax,
    BPMmax,
    A,
    singability,
    complexity,
    meterName,
    scheme,
    rhymeSignature,
    anacrusis: detectedAnacrusis,
    pauseCount,
    segments,
    syllables: allSyllables
  };
}

/**
 * Compares two phonetic rhyme signatures (from the last stressed vowel to the end of the line)
 * Returns 'exact' for full phonetic rhyme, 'assonance' for matching stressed vowel + similar ending, or null.
 */
export function compareRhymeSignatures(sigA: string, sigB: string): 'exact' | 'assonance' | null {
  if (!sigA || !sigB || sigA.length < 1 || sigB.length < 1) return null;

  const normalizeRhyme = (s: string) =>
    s
      .toLowerCase()
      .replace(/я/g, 'а')
      .replace(/ю/g, 'у')
      .replace(/є/g, 'е')
      .replace(/ї/g, 'і')
      .replace(/ь/g, '')
      .replace(/['’ʼ‘`]/g, '');

  const normA = normalizeRhyme(sigA);
  const normB = normalizeRhyme(sigB);

  if (normA === normB) return 'exact';

  const vowelsA = Array.from(normA).filter(ch => VOWELS.has(ch));
  const vowelsB = Array.from(normB).filter(ch => VOWELS.has(ch));

  if (vowelsA.length > 0 && vowelsA.length === vowelsB.length && vowelsA[0] === vowelsB[0]) {
    const lastA = normA[normA.length - 1];
    const lastB = normB[normB.length - 1];
    if (lastA === lastB || (VOWELS.has(lastA) && VOWELS.has(lastB))) {
      return 'assonance';
    }
    if (vowelsA.length >= 2 && vowelsA[vowelsA.length - 1] === vowelsB[vowelsB.length - 1]) {
      return 'assonance';
    }
  }

  return null;
}

export function formatMetrics(metrics: ProsodyMetrics) {
  return {
    syllables: `${metrics.S} скл`,
    singability: `${Math.round(metrics.singability)}%`,
    bpmMax: `${Math.round(metrics.BPMmax)} BPM`,
    accuracy: `${Math.round(metrics.A * 100)}%`,
    meter: metrics.meterName
  };
}

export function applyAccentsToText(text: string, dictionary: Record<string, number> = {}): string {
  const metrics = analyzeTextCached(text, 120, 4, dictionary);
  let result = "";

  metrics.segments.forEach(segment => {
    if (segment.type === 'separator') {
      result += segment.text;
    } else {
      const word = segment.text;
      const stressedSyllableIdx = segment.syllables.findIndex(s => s.stressed);

      if (stressedSyllableIdx !== -1 && segment.syllables.length > 1) {
        let currentVowelIdx = 0;
        let wordResult = "";
        for (let i = 0; i < word.length; i++) {
          const char = word[i].toLowerCase();
          if (VOWELS.has(char)) {
            wordResult += word[i];
            if (currentVowelIdx === stressedSyllableIdx) {
              if (word[i + 1] !== '\u0301') {
                wordResult += '\u0301';
              }
            }
            currentVowelIdx++;
          } else if (word[i] !== '\u0301') {
            wordResult += word[i];
          }
        }
        result += wordResult;
      } else {
        result += word;
      }
    }
  });

  return result;
}

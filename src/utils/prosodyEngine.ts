import globalDictionary from './dictionary.json';
import { ExtendedStressDB, getCachedStressDB, saveCachedStressDB } from '../db';

let extendedStressDB: ExtendedStressDB | null = null;
let loadingPromise: Promise<ExtendedStressDB | null> | null = null;

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
  if (extendedStressDB) return extendedStressDB;
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    try {
      const cached = await getCachedStressDB();
      if (cached && cached.version === 2) {
        extendedStressDB = cached;
        return cached;
      }
      const response = await fetch('/stress-db.json');
      if (response.ok) {
        const data: ExtendedStressDB = await response.json();
        extendedStressDB = data;
        await saveCachedStressDB(data);
        return data;
      }
    } catch (e) {
      console.warn('Extended stress DB fallback to bootstrap dictionary:', e);
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

const Kh = 0.25;
const Gh = 0.15;
const Xh = 0.1;
const Zh = 6;

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
  rMax: number;          // Max recommended rate
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
    // Reflexive verb endings -ться / -шся -> single prolonged phoneme
    .replace(/ться/g, 'ця')
    .replace(/шся/g, 'ся')
    // Classical Ukrainian cluster simplifications in living pronunciation
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
      // Affricate digraphs дж / дз act as 1 phoneme
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

  // First consonant in a syllable is natural onset (0 extra cluster penalty)
  let articulatoryLoad = 0;
  for (let i = 1; i < phones.length; i++) {
    const prev = phones[i - 1];
    const curr = phones[i];

    const prevIsObstruent = PLOSIVES.has(prev) || SIBILANTS.has(prev) || prev === 'дж' || prev === 'дз';
    const currIsSonorant = SONORANTS.has(curr) || GLIDES.has(curr);
    const prevIsSonorant = SONORANTS.has(prev) || GLIDES.has(prev);
    const currIsObstruent = PLOSIVES.has(curr) || SIBILANTS.has(curr) || curr === 'дж' || curr === 'дз';

    if (prevIsObstruent && currIsSonorant) {
      // Muta cum liquida (пр, тр, кр, пл, бл, кл, сл, зн) — smooth single-gesture articulation
      articulatoryLoad += 0.12;
    } else if (prevIsSonorant && currIsObstruent) {
      // Sonorant-to-obstruent descent (рт, лк, нк, мп)
      articulatoryLoad += 0.18;
    } else if (prevIsObstruent && currIsObstruent) {
      // Heavy obstruent/sibilant clash (кт, пт, гд, тч, сш, зж, стк) — forces vocal tract reset
      articulatoryLoad += 0.36;
    } else {
      articulatoryLoad += Kh;
    }
  }

  return { count, articulatoryLoad, vowelChar };
}

/**
 * Counts phonetic consonant load in a syllable.
 */
export function countPhoneticConsonants(sylLower: string, prevCharBeforeSyl?: string): number {
  return analyzeSyllablePhonetics(sylLower, prevCharBeforeSyl).count;
}

/**
 * Evaluates syllable coda closure & Ukrainian glide vocalization (в -> [ў], й -> [і̯]).
 */
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

  // Ukrainian bilabial [ў] ('в') and palatal [і̯] ('й') at syllable coda vocalize into a semi-vowel glide
  if (GLIDES.has(lastChar)) {
    return { closed: false, glideClosed: true, opennessScore: 0.85 };
  }

  // Sonorants (м, н, л, р) can still carry pitch (voicing), unlike voiceless stops
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
 * Multi-tier Ukrainian stress lookup backed by NASU 2.93M wordform database + morphological rules.
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

  // 2. Extended NASU database (if loaded in memory)
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

  // 3. Synchronous bootstrap dictionary (9,169 high-frequency short words)
  if ((globalDictionary as Record<string, number>)[cleanWord] !== undefined) {
    const idx = (globalDictionary as Record<string, number>)[cleanWord];
    return { primary: Math.max(0, Math.min(totalVowels - 1, idx)) };
  }

  // 4. Morphological fallback
  return { primary: detectStress(cleanWord) };
}

/**
 * Morphologically enhanced Ukrainian stress heuristic.
 */
export function detectStress(word: string): number {
  const wordLower = word.toLowerCase().replace(/[\u0301'’ʼ‘`]/g, '');
  const vowelIndices: number[] = [];
  for (let i = 0; i < wordLower.length; i++) {
    if (VOWELS.has(wordLower[i])) vowelIndices.push(i);
  }

  const n = vowelIndices.length;
  if (n <= 1) return 0;

  // 1. Prefix "ви-" in verbs/nouns often pulls stress to the first syllable (e.g., ви́їхав, ви́бір)
  if (wordLower.startsWith('ви') && n >= 2 && (wordLower.endsWith('ти') || wordLower.endsWith('в') || wordLower.endsWith('ла') || wordLower.endsWith('ли'))) {
    return 0;
  }

  // 2. Past tense verbs & specific final-stress suffixes (-ив, -их, -ов, -ла, -ло, -ли, -уть, -ять, -іть, -имо, -ете)
  if (
    wordLower.endsWith('ив') || wordLower.endsWith('их') || wordLower.endsWith('ов') ||
    wordLower.endsWith('ла') || wordLower.endsWith('ло') || wordLower.endsWith('ли') ||
    wordLower.endsWith('имо') || wordLower.endsWith('ете') || wordLower.endsWith('узь') ||
    wordLower.endsWith('ання') === false && (wordLower.endsWith('тя') || wordLower.endsWith('ття'))
  ) {
    return n - 1;
  }

  // 3. Polysyllabic verbal nouns on -ння, -ття, -ість, -ування, -ювання (penultimate stress)
  if (
    wordLower.endsWith('ння') || wordLower.endsWith('ість') ||
    wordLower.endsWith('увати') || wordLower.endsWith('ювати')
  ) {
    return Math.max(0, n - 2);
  }

  // 4. Adjectives on -ський, -цький, -зький, -овий, -евий
  if (
    wordLower.endsWith('ський') || wordLower.endsWith('цький') || wordLower.endsWith('зький') ||
    wordLower.endsWith('ська') || wordLower.endsWith('цька') || wordLower.endsWith('зька')
  ) {
    return Math.max(0, n - 2);
  }

  // 5. Standard Ukrainian statistical distribution
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

  // Narrow high vowels (і, и, у) require less jaw opening and articulate faster in dense lines
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
function extractRhymeSignature(syllables: Syllable[]): string {
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

  // Tokenize keeping all Ukrainian letters, combining acute accent \u0301, and all apostrophe variants
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

      // 2. Multi-tier Dictionary & Stem/Suffix lookup (if no manual \u0301 in text)
      if (stressIndex === undefined && vowelGraphemeIndices.length > 0) {
        const lookup = lookupWordStress(cleanWord, vowelGraphemeIndices.length, dictionary);
        stressIndex = lookup.primary;
        wordCandidateStresses = lookup.candidates;
      }

      // Clamp stressIndex if out of bounds
      if (stressIndex !== undefined && vowelGraphemeIndices.length > 0) {
        stressIndex = Math.max(0, Math.min(vowelGraphemeIndices.length - 1, stressIndex));
      }

      // Handle vowelless words (Ukrainian proclitics/enclitics like "в", "з", "ж", "б")
      if (vowelGraphemeIndices.length === 0) {
        const { count: consCount } = analyzeSyllablePhonetics(cleanWord);
        if (allSyllables.length > 0 && (cleanWord === 'ж' || cleanWord === 'б')) {
          // Enclitics ("ж", "б") attach to the preceding word
          const prevSyl = allSyllables[allSyllables.length - 1];
          prevSyl.consonants += consCount;
          prevSyl.articulatoryLoad = (prevSyl.articulatoryLoad ?? 0) + 0.18;
          prevSyl.closed = true;
          prevSyl.opennessScore = 0.0;
        } else {
          // Proclitics ("в", "з", "із" vowelless) merge forward into the next word's first syllable
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

      // 4. Level 1 Cross-Word Resyllabification (Sandhi):
      // If the current word starts with a vowel and there was no punctuation pause,
      // a trailing consonant from the previous word's last syllable flows into this syllable's onset!
      const startsWithVowelSound = VOWELS.has(graphemes[0][0].toLowerCase()) && pendingConsonantsFromProclitic === 0;
      if (startsWithVowelSound && !lastSeparatorHadPause && allSyllables.length > 0) {
        const prevSyl = allSyllables[allSyllables.length - 1];
        if (prevSyl.closed || prevSyl.glideClosed) {
          // Resyllabify across word boundary: previous syllable opens up acoustically!
          prevSyl.closed = false;
          prevSyl.glideClosed = false;
          prevSyl.opennessScore = 0.95; // Continuous vocalic flow across word boundary
        }
      }

      // Also if the previous word ended in a vowel and this word is "в" + consonant (e.g. "моя врода"),
      // Ukrainian vocalizes initial 'в' into [ў] closing the previous vowel gently instead of hard onset cluster
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
          // 'в' before consonant vocalized into previous vowel as [ў], reducing onset cluster load
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
        // Unstressed functional monosyllables (clitics: і, у, а, та, як, що, не, бо, чи, то, за, на, по, до, зі)
        const isClitic =
          totalVowels === 1 &&
          !hasManualAccent &&
          cleanWord.length <= 3 &&
          !closure.closed &&
          !closure.glideClosed;
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

    // Detect if the line has an anacrusis (1 or 2 unstressed pickup syllables before the first stressed P-center)
    // e.g. "І на оно́вленій землі́" -> first stress is at index 2 or 3
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

          // Allow secondary strong anchor on half-beat subdivision for dense lines
          if (effectiveS >= safeBeats * 1.5 && safeSubs >= 2) {
            const subAnchor = anacrusisOffset + Math.round(((b + 0.5) * effectiveS) / safeBeats);
            if (subAnchor < S) candidateSet.add(subAnchor);
          }
        }
      }

      // Also check P-center isochrony: if stressed syllables themselves form an even chain
      // (intervals of 2 or 3 syllables between stresses), reward that alignment
      const hits = stressedIndices.filter(idx => candidateSet.has(idx)).length;
      const score = stressedIndices.length > 0 ? hits / stressedIndices.length : 1;

      if (score > bestHitScore) {
        bestHitScore = score;
        bestStrongSet = candidateSet;
        bestOffset = anacrusisOffset;
      }
    }

    detectedAnacrusis = bestOffset;

    // Beat-Adaptive Double-Stress / Homograph Resolution:
    // If a word has multiple valid stresses in the NASU dictionary (e.g., за́мок/замо́к, по́ми́лка, за́вжди́)
    // and its default stress is off-beat while an alternative valid stress lands directly on bestStrongSet,
    // automatically shift stress to the beat-aligned syllable!
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

    // Check if P-center intervals between stressed syllables are isochronous (e.g., all intervals are 2 or 3 syllables)
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

  // Acoustic openness (O) uses opennessScore (accounting for sandhi & vocalized glides [ў]/[і̯])
  // plus resonance bonus for wide cantilena vowels (а, о)
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

  // Average biomechanical cluster load per syllable directly informs rMax
  const avgClusterLoad = S > 0
    ? allSyllables.reduce((acc, s) => acc + (s.articulatoryLoad ?? 0), 0) / S
    : 0;

  let rMax = Zh * (1 - 1.4 * avgClusterLoad) * (1 + 0.25 * (O - 0.5));
  if (rMax < 0.5) rMax = 0.5;

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

  // Assonance / slant rhyme: same stressed initial vowel AND same syllable count in the clause
  const vowelsA = Array.from(normA).filter(ch => VOWELS.has(ch));
  const vowelsB = Array.from(normB).filter(ch => VOWELS.has(ch));

  if (vowelsA.length > 0 && vowelsA.length === vowelsB.length && vowelsA[0] === vowelsB[0]) {
    // Check if the final vowel or final consonant class also aligns
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
  const metrics = analyzeText(text, 120, 4, dictionary);
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


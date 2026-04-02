import globalDictionary from './dictionary.json';

export const VOWELS = new Set(["а", "е", "є", "и", "і", "ї", "о", "у", "ю", "я", "a", "e", "i", "o", "u", "y"]);
export const CONSONANTS = new Set(["б", "в", "г", "ґ", "д", "ж", "з", "й", "к", "л", "м", "н", "п", "р", "с", "т", "ф", "х", "ц", "ч", "ш", "щ", "b", "c", "d", "f", "g", "h", "j", "k", "l", "m", "n", "p", "q", "r", "s", "t", "v", "w", "x", "z"]);

const Kh = 0.25;
const Gh = 0.15;
const Xh = 0.1;
const Yh = 0.1;
const Zh = 6;

export interface Syllable {
  text: string;
  fullText: string;
  isWord: boolean;
  closed: boolean;
  consonants: number;
  stressed: boolean;
  misstress: boolean;
  beatIndex?: number;
}

export interface Segment {
  type: 'word' | 'separator';
  text: string;
  syllables: Syllable[];
}

export interface ProsodyMetrics {
  S: number;           // Syllable count
  S_eff: number;       // Effective syllable count
  O: number;           // Openness
  Cavg: number;        // Average consonants
  SD: number;          // Syllable density
  r: number;           // Rate
  rMax: number;        // Max recommended rate
  BPMmax: number;      // Max recommended BPM
  A: number;           // Accuracy
  singability: number; // 0-100
  complexity: number;  // 0-100
  segments: Segment[];
  syllables: Syllable[];
}

export function isVowel(char: string): boolean {
  return VOWELS.has(char.toLowerCase());
}

export function isSectionMarker(text: string): boolean {
  const t = text.trim();
  return t.length > 2 && t.startsWith("[") && t.endsWith("]");
}

export function detectStress(word: string): number {
  const wordLower = word.toLowerCase();
  const vowelIndices: number[] = [];
  [...wordLower].forEach((char, i) => {
    if (VOWELS.has(char)) vowelIndices.push(i);
  });
  
  const n = vowelIndices.length;
  if (n <= 1) return 0;

  // Покращена евристика для української мови
  // Дієслова минулого часу (стулив, затих, прийшов)
  if (wordLower.endsWith('ив') || wordLower.endsWith('их') || wordLower.endsWith('ов') || wordLower.endsWith('ла') || wordLower.endsWith('ло') || wordLower.endsWith('ли')) {
    return n - 1; 
  }
  
  // Іменники на -ння, -ття
  if (wordLower.endsWith('ння') || wordLower.endsWith('ття')) {
    return n - 2;
  }

  // Стандартна евристика
  if (n === 2) return 0; // Часто на перший склад
  if (n === 3) return 1; // Часто на другий склад
  
  return Math.max(0, n - 2);
}

export function getSyllableWeight(syllable: Syllable): number {
  if (!syllable.isWord) return 0;
  const closedWeight = syllable.closed ? 1 : 0;
  const openWeight = syllable.closed ? 0 : 1;
  // Вага наголосу тепер враховується тільки якщо він збігається з долею
  const stressWeight = (syllable.stressed && !syllable.misstress) ? 1.5 : 1.0;
  const weight = stressWeight + Kh * (syllable.consonants - 1) + Gh * closedWeight - Xh * openWeight;
  return Math.max(0.5, weight);
}

export function analyzeText(text: string, bpm: number, beats: number, dictionary: Record<string, number> = {}): ProsodyMetrics {
  const segments: Segment[] = [];
  const allSyllables: Syllable[] = [];

  // Об'єднуємо глобальний словник та користувацький
  const mergedDictionary: Record<string, number> = { ...globalDictionary, ...dictionary };

  text.split(/([^a-zA-Zа-яА-ЯіїєґІЇЄҐ\u0301']+)/).forEach(part => {
    if (!part) return;
    if (!/[a-zA-Zа-яА-ЯіїєґІЇЄҐ\u0301]/.test(part)) {
      const segment: Segment = {
        type: 'separator',
        text: part,
        syllables: [{
          text: part,
          fullText: part,
          isWord: false,
          closed: false,
          consonants: 0,
          stressed: false,
          misstress: false
        }]
      };
      segments.push(segment);
    } else {
      const syllables: Syllable[] = [];
      const wordLower = part.toLowerCase();
      
      // 1. Check for manual Unicode stress \u0301
      let stressIndex: number | undefined = undefined;
      const vowelPositions: number[] = [];
      
      // We need to iterate through the word and find vowels AND check if they are followed by \u0301
      let vowelCount = 0;
      for (let i = 0; i < part.length; i++) {
        const char = part[i].toLowerCase();
        if (VOWELS.has(char)) {
          vowelPositions.push(i);
          if (part[i + 1] === '\u0301') {
            stressIndex = vowelCount;
          }
          vowelCount++;
        }
      }

      // 2. If no manual stress, check dictionary
      if (stressIndex === undefined) {
        // Clean word from any existing stress marks for dictionary lookup
        const cleanWord = wordLower.replace(/\u0301/g, '');
        stressIndex = mergedDictionary[cleanWord];
      }
      
      // 3. Fallback to heuristic
      if (stressIndex === undefined) {
        stressIndex = detectStress(part.replace(/\u0301/g, ''));
      }

      if (vowelPositions.length === 0) {
        syllables.push({
          text: wordLower,
          fullText: part,
          isWord: true,
          closed: true,
          consonants: part.length,
          stressed: false,
          misstress: false
        });
      } else {
        let lastSplit = -1;
        vowelPositions.forEach((pos, idx) => {
          let start = lastSplit + 1;
          let end = pos + 1;
          if (idx === vowelPositions.length - 1 && pos < part.length - 1) {
            end = part.length;
            lastSplit = part.length;
          } else {
            lastSplit = pos;
          }
          const sylText = part.substring(start, end);
          const sylLower = sylText.toLowerCase();
          const consonantsCount = [...sylLower].filter(c => CONSONANTS.has(c)).length;
          const lastChar = sylLower[sylLower.length - 1];
          const isClosed = CONSONANTS.has(lastChar);
          const isStressed = stressIndex === idx;

          syllables.push({
            text: sylLower,
            fullText: sylText,
            isWord: true,
            closed: isClosed,
            consonants: consonantsCount,
            stressed: isStressed,
            misstress: false
          });
        });
      }
      segments.push({ type: 'word', text: part, syllables });
      syllables.forEach(s => allSyllables.push(s));
    }
  });

  const S = allSyllables.length;
  // Розрахунок долей: кожна доля має свій "сильний" склад
  const syllablesPerBeat = beats > 0 ? S / beats : 1;
  
  allSyllables.forEach((s, i) => {
    const beatIdx = Math.floor(i / syllablesPerBeat);
    s.beatIndex = beatIdx % beats;
    
    // Склад вважається таким, що потрапляє в долю, якщо він перший у групі
    const isDownbeat = i % Math.max(1, Math.floor(syllablesPerBeat)) === 0;
    
    // Misstress: якщо слово має наголос, але він не на долі
    // АБО якщо доля падає на ненаголошений склад (це теж важливо для репу/пісень)
    if (s.stressed && !isDownbeat) {
      s.misstress = true;
    }
  });

  const S_eff = allSyllables.reduce((acc, s) => acc + getSyllableWeight(s), 0);
  const openCount = allSyllables.filter(s => !s.closed).length;
  const totalConsonants = allSyllables.reduce((acc, s) => acc + s.consonants, 0);
  
  const O = S > 0 ? openCount / S : 0;
  const Cavg = S > 0 ? totalConsonants / S : 0;
  const SD = beats > 0 ? S_eff / beats : 0;
  const r = beats > 0 ? (S_eff * bpm) / (60 * beats) : 0;
  
  let rMax = Zh * (1 - 0.5 * (Cavg - 1)) * (1 + 0.2 * (O - 0.5));
  if (rMax < 0) rMax = 0;
  
  const BPMmax = S_eff > 0 ? (rMax * 60 * beats) / S_eff : 0;
  const singability = Math.min(100, Math.max(0, O * 100));
  const complexity = Math.min(100, Math.max(0, (Cavg / 2.5) * 100));
  
  const stressedSyllables = allSyllables.filter(s => s.stressed);
  const correctStressCount = stressedSyllables.filter(s => !s.misstress).length;
  const A = stressedSyllables.length > 0 ? correctStressCount / stressedSyllables.length : 1;

  return {
    S, S_eff, O, Cavg, SD, r, rMax, BPMmax, A, singability, complexity, segments, syllables: allSyllables
  };
}

export function formatMetrics(metrics: ProsodyMetrics) {
  return {
    syllables: `${metrics.S} скл`,
    singability: `${Math.round(metrics.singability)}%`,
    bpmMax: `${Math.round(metrics.BPMmax)} BPM`,
    accuracy: `${Math.round(metrics.A * 100)}%`
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
      
      if (stressedSyllableIdx !== -1) {
        let currentVowelIdx = 0;
        let wordResult = "";
        for (let i = 0; i < word.length; i++) {
          const char = word[i].toLowerCase();
          if (VOWELS.has(char)) {
            wordResult += word[i];
            if (currentVowelIdx === stressedSyllableIdx) {
              // Check if next char is already a stress mark
              if (word[i+1] !== '\u0301') {
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

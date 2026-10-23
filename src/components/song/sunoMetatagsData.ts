export type MetatagCategoryKey = 'genre' | 'mood' | 'style' | 'vocal' | 'fx';

export interface MetatagChip {
  id: string;
  label: string;
  category: MetatagCategoryKey;
  subcategoryId: string;
  isCustom?: boolean;
}

export interface MetatagSubcategory {
  id: string;
  title: string;
  uaHint: string;
  category: MetatagCategoryKey;
  tags: string[];
  nextSubcategoryId?: string;
}

export interface ChainPreset {
  id: string;
  name: string;
  chips: Omit<MetatagChip, 'id'>[];
}

export interface ExcludePreset {
  id: string;
  name: string;
  uaHint: string;
  tags: string[];
}

export type MetatagFormatMode = 'grouped' | 'pipes' | 'separate';

export interface CustomMetatagStore {
  customTagsBySubcategory: Record<string, string[]>;
  parentToNextSubcategory: Record<string, string>;
  parentToCustomTags: Record<string, string[]>;
  chainPresets: ChainPreset[];
  formatMode: MetatagFormatMode;
  globalStyleChips: MetatagChip[];
  excludeStyleChips: MetatagChip[];
  musicalKey: string;
  lockKeyBpmInStyle: boolean;
  useMaxModeHeader: boolean;
}

export const METATAG_STORAGE_KEY = 'b-note-suno-metatags-v1';

// Strictly Latin, unnumbered section headers per Suno & daveshap standard
export const LATIN_SECTION_PRESETS = [
  '[INTRO]',
  '[VERSE]',
  '[PRE-CHORUS]',
  '[CHORUS]',
  '[HOOK]',
  '[POST-CHORUS]',
  '[INTERLUDE]',
  '[BRIDGE]',
  '[BUILD]',
  '[BREAK]',
  '[DROP]',
  '[BREAKDOWN]',
  '[INSTRUMENTAL]',
  '[SOLO]',
  '[MOVEMENT]',
  '[OUTRO]',
  '[END]',
] as const;

export const MUSICAL_KEY_PRESETS = [
  'A Minor',
  'C Minor',
  'D Minor',
  'E Minor',
  'F# Minor',
  'G Minor',
  'B Minor',
  'C Major',
  'D Major',
  'E Major',
  'F Major',
  'G Major',
  'A Major',
] as const;

// MAX Mode & Start-On Header from Suno Field Guide (Grenar Trick #7 + MAX Realism Stack)
export const MAX_MODE_HEADER_BLOCK = `[Is_MAX_MODE: MAX](MAX)
[QUALITY: MAX](MAX)
[REALISM: MAX](MAX)
[REAL_INSTRUMENTS: MAX](MAX)
[START_ON: TRUE]`;

// Exclude Styles Presets (PureRely Anti-Intro-Hum + Escape Pop Gravity Well + Anti-Sawtooth)
export const EXCLUDE_STYLE_PRESETS: ExcludePreset[] = [
  {
    id: 'anti_intro_hum',
    name: 'Anti-Intro-Hum (PureRely)',
    uaHint: 'Прибирає мичання та бубоніння на старті треку (v5/v5.5)',
    tags: [
      'humming',
      'mumbling',
      'distorted vocal start',
      'ambient noise intro',
      'spoken intro',
      'blurry vocals',
      'ooh vocals',
      'ahh vocals',
    ],
  },
  {
    id: 'escape_pop_gravity',
    name: 'Escape Pop Gravity',
    uaHint: 'Витягує трек із глянцевої поп-пастки Suno',
    tags: [
      'pop',
      'dance-pop',
      'bright',
      'clean production',
      'generic EDM',
      'teen pop',
      'bubblegum',
    ],
  },
  {
    id: 'anti_sawtooth_harsh',
    name: 'No Cheap Sawtooth',
    uaHint: 'Блокує дешеві пластикові пилкоподібні синти',
    tags: [
      'harsh sawtooth lead',
      'cheap midi synth',
      'thin plastic bass',
      'piercing high frequencies',
      'over-compressed',
    ],
  },
  {
    id: 'no_muddy_diction',
    name: 'Anti-Muddy Diction',
    uaHint: 'Проти каші у вимові та надмірного холу на вокалі',
    tags: [
      'muffled vocals',
      'washed out reverb',
      'slurred pronunciation',
      'buried vocals',
      'robotic autotune',
    ],
  },
];

// Maps legacy Cyrillic or numbered section headers to clean unnumbered Latin tags
export function normalizeSectionToLatin(rawText: string): string {
  const inside = rawText.replace(/[\[\]]/g, '').trim().toUpperCase();
  if (!inside) return '[VERSE]';

  // Strip trailing numbers like "VERSE 1", "КУПЛЕТ 2", "CHORUS #1"
  const withoutNumbers = inside.replace(/\s*#?\d+\s*$/g, '').trim();

  const map: Record<string, string> = {
    'ІНТРО': 'INTRO',
    'ВСТУП': 'INTRO',
    'INTRO': 'INTRO',
    'КУПЛЕТ': 'VERSE',
    'VERSE': 'VERSE',
    'ПРЕ-ХОРУС': 'PRE-CHORUS',
    'ПРЕХОРУС': 'PRE-CHORUS',
    'ПЕРЕДПРИСПІВ': 'PRE-CHORUS',
    'PRE-CHORUS': 'PRE-CHORUS',
    'PRECHORUS': 'PRE-CHORUS',
    'ПРИСПІВ': 'CHORUS',
    'ХОРУС': 'CHORUS',
    'CHORUS': 'CHORUS',
    'ХУК': 'HOOK',
    'HOOK': 'HOOK',
    'ПОСТ-ХОРУС': 'POST-CHORUS',
    'POST-CHORUS': 'POST-CHORUS',
    'ІНТЕРЛЮДІЯ': 'INTERLUDE',
    'INTERLUDE': 'INTERLUDE',
    'БРІДЖ': 'BRIDGE',
    'БРИДЖ': 'BRIDGE',
    'МІСТ': 'BRIDGE',
    'BRIDGE': 'BRIDGE',
    'БІЛД': 'BUILD',
    'НАГНІТАННЯ': 'BUILD',
    'BUILD': 'BUILD',
    'BUILD-UP': 'BUILD',
    'БРЕЙК': 'BREAK',
    'ПАУЗА': 'BREAK',
    'BREAK': 'BREAK',
    'ДРОП': 'DROP',
    'DROP': 'DROP',
    'БРЕЙКДАУН': 'BREAKDOWN',
    'ЗЛАМ': 'BREAKDOWN',
    'BREAKDOWN': 'BREAKDOWN',
    'ІНСТРУМЕНТАЛ': 'INSTRUMENTAL',
    'ПРОГРАШ': 'INSTRUMENTAL',
    'INSTRUMENTAL': 'INSTRUMENTAL',
    'СОЛО': 'SOLO',
    'SOLO': 'SOLO',
    'ЧАСТИНА': 'MOVEMENT',
    'MOVEMENT': 'MOVEMENT',
    'АУТРО': 'OUTRO',
    'ФІНАЛ': 'OUTRO',
    'КОДА': 'OUTRO',
    'OUTRO': 'OUTRO',
    'КІНЕЦЬ': 'END',
    'END': 'END',
  };

  const mapped = map[withoutNumbers] || withoutNumbers.replace(/[^A-Z\s\-]/g, '').trim() || 'VERSE';
  return `[${mapped}]`;
}

export const CATEGORY_META: Record<
  MetatagCategoryKey,
  {
    label: string;
    shortLabel: string;
    borderClass: string;
    badgeClass: string;
    glowClass: string;
  }
> = {
  genre: {
    label: 'Genre / Core',
    shortLabel: 'GENRE',
    borderClass: 'border-orange-accent/55 hover:border-orange-accent',
    badgeClass: 'text-orange-accent bg-orange-accent/15',
    glowClass: 'shadow-[0_2px_12px_rgba(255,107,0,0.12)]',
  },
  mood: {
    label: 'Mood / Vibe',
    shortLabel: 'MOOD',
    borderClass: 'border-violet-400/50 hover:border-violet-400',
    badgeClass: 'text-violet-300 bg-violet-500/15',
    glowClass: 'shadow-[0_2px_12px_rgba(139,92,246,0.12)]',
  },
  style: {
    label: 'Style / Gear / Realism',
    shortLabel: 'STYLE',
    borderClass: 'border-cyan-400/50 hover:border-cyan-400',
    badgeClass: 'text-cyan-300 bg-cyan-500/15',
    glowClass: 'shadow-[0_2px_12px_rgba(34,211,238,0.12)]',
  },
  vocal: {
    label: 'Vocals / Clarity',
    shortLabel: 'VOCAL',
    borderClass: 'border-emerald-400/50 hover:border-emerald-400',
    badgeClass: 'text-emerald-300 bg-emerald-500/15',
    glowClass: 'shadow-[0_2px_12px_rgba(16,185,129,0.12)]',
  },
  fx: {
    label: 'Drops / Tricks / MAX',
    shortLabel: 'ACTION',
    borderClass: 'border-rose-400/55 hover:border-rose-400',
    badgeClass: 'text-rose-300 bg-rose-500/15',
    glowClass: 'shadow-[0_2px_12px_rgba(244,63,94,0.14)]',
  },
};

// Suno Field Guide & Reddit Empirical Cascading Taxonomy
export const SUNO_SUBCATEGORIES: MetatagSubcategory[] = [
  // 1. GENRE / CORE DIRECTION
  {
    id: 'genre_core',
    title: 'Core Direction / Genre',
    uaHint: 'Базовий напрям (Field Guide)',
    category: 'genre',
    nextSubcategoryId: 'mood_cinematic',
    tags: [
      'Cinematic',
      'Dark Electro',
      'Alternative Rock',
      'Modern Metal',
      'Hip-Hop / Trap',
      'Phonk / Drift',
      'Synthwave / Retrowave',
      'Industrial Bass',
      'Orchestral Hybrid',
      'Dark Folk / Ethnic',
      'Cyberpunk Midtempo',
      'Post-Punk / Coldwave',
      'Drum & Bass',
      'Melodic Techno',
      '80s Dark Synthpop',
      '90s Boom-Bap',
    ],
  },

  // 2. MOOD / ATMOSPHERE SUB-TREES (Empirically verified descriptors)
  {
    id: 'mood_cinematic',
    title: 'Cinematic & Scale Mood',
    uaHint: 'Масштаб і драматургія',
    category: 'mood',
    nextSubcategoryId: 'style_orchestral',
    tags: [
      'Dark',
      'Heroic',
      'Epic',
      'Monumental',
      'Dramatic',
      'Tragic',
      'Apocalyptic',
      'Darkening Atmospheric',
      'Suspenseful',
      'Dystopian',
      'Triumphant',
      'Ominous',
      'Mythic',
    ],
  },
  {
    id: 'mood_aggressive',
    title: 'Aggressive & Dark Energy',
    uaHint: 'Напір і темна енергія (90%+ дієвість)',
    category: 'mood',
    nextSubcategoryId: 'style_electronic',
    tags: [
      'Aggressive',
      'Desperate',
      'Haunting',
      'Menacing',
      'Brutal',
      'Relentless',
      'Gritty',
      'Raw Energy',
      'Hypnotic',
      'Cold & Mechanical',
      'Explosive',
      'Fierce',
    ],
  },
  {
    id: 'mood_emotional',
    title: 'Emotional & Morphological Vibe',
    uaHint: 'Емоційні тригери та морфологічні обходи',
    category: 'mood',
    nextSubcategoryId: 'style_band',
    tags: [
      'Anthemic Chorus',
      'Bittersweet',
      'Melancholic',
      'Etherealer',
      'Etherealing',
      'Nostalgic',
      'Uplifting',
      'Intimate',
      'Soulful',
      'Dreamy',
      'Euphoric',
      'Mystical',
    ],
  },

  // 3. STYLE / ARRANGEMENT / GEAR / REALISM SUB-TREES
  {
    id: 'style_orchestral',
    title: 'Orchestral & Symphonic Layer',
    uaHint: 'Оркестровка і прогресія',
    category: 'style',
    nextSubcategoryId: 'fx_transitions',
    tags: [
      'Orchestral',
      'Progressive',
      'Modern',
      'Symphonic',
      'Hybrid Brass',
      'Staccato Strings',
      'Epic Choir',
      'Tribal War Drums',
      'Cinematic Braams',
      'Cello Ostinato',
      'Grand Piano Motif',
      'Wide Stadium Mix',
    ],
  },
  {
    id: 'style_electronic',
    title: 'Anti-Sawtooth & Electronic Bass',
    uaHint: 'FM/Wavetable бас без дешевої пилки',
    category: 'style',
    nextSubcategoryId: 'fx_drops',
    tags: [
      'FM Synthesis Bass',
      'Wavetable Movement',
      'Warm Reese Bass',
      'LFO-Driven Modulation',
      '808 Sidechain Ducking',
      'Rounded Harmonic Profile',
      'Tight Transients',
      'Heavy TR-808 Sub Bass',
      'Hard-Hitting Trap Beat',
      'Industrial Percussion',
      'Distorted Cowbell',
      'Half-Time Heavy Groove',
    ],
  },
  {
    id: 'style_band',
    title: 'Specific Gear, Guitars & Live Band',
    uaHint: 'Конкретні моделі гітар, ударні та фолк',
    category: 'style',
    nextSubcategoryId: 'style_realism',
    tags: [
      'Epiphone Les Paul Standard',
      'Fender American Telecaster',
      'Gretsch G5422TG Hollowbody',
      'Hammond B3 Organ',
      'Rhodes Mark I Electric Piano',
      'Punishing Drums',
      'Downtuned Heavy Guitars',
      'Chugging Metal Riffs',
      'Acoustic Fingerpicking',
      'Post-Rock Guitar Wall',
      'Gated Reverb Drums',
      'Bandura & Kobza Motif',
      'Trembita Call',
    ],
  },
  {
    id: 'style_realism',
    title: 'Acoustic Realism & Remaster Stack',
    uaHint: 'Мікрофонна фізика, кімната та аналоговий мастеринг',
    category: 'style',
    nextSubcategoryId: 'vocal_delivery',
    tags: [
      'Close Mic Presence',
      'Proximity Effect',
      'Breath Detail',
      'Pick Noise & Fret Squeak',
      'Small Room Acoustics',
      'Tape Saturation',
      'Natural Dynamics',
      'Analog Warmth',
      'High_Fidelity',
      'Studio_Mix',
      'Crystal_Clarity',
      'Punchy_Dynamics',
      'Smooth_Transients',
    ],
  },

  // 4. VOCALS, DELIVERY & BROADWAY CLARITY OVERRIDE
  {
    id: 'vocal_delivery',
    title: 'Vocal Tone & Delivery',
    uaHint: 'Подача вокалу та тембр',
    category: 'vocal',
    nextSubcategoryId: 'vocal_fx',
    tags: [
      'Gritty Vocals',
      'Deep Male Vocal',
      'Raspy Lead Vocal',
      'Aggressive Rap Flow',
      'Powerful Female Vocal',
      'Whispered Delivery',
      'Spoken Word Verse',
      'Baritone Chant',
      'Emotional Belting',
      'Falsetto Hook',
      'Guttural Scream',
      'Raw Unpolished Vocal',
    ],
  },
  {
    id: 'vocal_fx',
    title: 'Broadway Clarity & Vocal FX',
    uaHint: 'Трюк №13 (ідеальна дикція) та вокальний простір',
    category: 'vocal',
    nextSubcategoryId: 'fx_drops',
    tags: [
      'Broadway Musical Clarity',
      'Hyper-Articulated Diction',
      'Dry Front-and-Center Lead Vocal',
      'Vocal_Depth',
      'Stacked Harmonies',
      'Anthemic Crowd Chant',
      'Cathedral Choir Backing',
      'Whispered Doubles',
      'Call and Response',
      'Slapback Delay',
      'Heavy Hall Reverb',
    ],
  },

  // 5. DYNAMICS, PAUSES, DIRTY TRICKS & DROPS
  {
    id: 'fx_transitions',
    title: 'Pauses, Intros & Building Intensity',
    uaHint: 'Паузи, розгін та Grenar-трюки',
    category: 'fx',
    nextSubcategoryId: 'fx_drops',
    tags: [
      'Building Intensity',
      'Start_On: True',
      'Heavy Slow Intro',
      'Sudden Pause: 1 Sec',
      'Complete Silence: 1 Sec',
      'Break . . .',
      'Break! Break! Break!',
      'Tension Riser',
      'Snare Roll Build-up',
      'Tape Stop Effect',
      'Live Stadium Acoustics',
      'Crowd Cheering Ambience',
      'Breath Before Drop',
    ],
  },
  {
    id: 'fx_drops',
    title: 'Drops, Climax & Terminal Endings',
    uaHint: 'Дропи, кульмінація, MAX-тригери та фінал',
    category: 'fx',
    nextSubcategoryId: 'vocal_delivery',
    tags: [
      'Massive Beat Drop',
      'Heavy Bass Drop',
      'Anthemic Chorus Entry',
      'Half-Time Breakdown',
      'Key Change (+1 Semitone)',
      'Full Wall of Sound',
      'Epic Guitar Solo',
      'Sudden Cut Ending',
      'Final Orchestral Hit',
      'End',
      'Is_MAX_MODE: MAX',
      'Realism: MAX',
    ],
  },
];

// Direct parent-tag -> ideal next subcategory routing (Reddit Suno Field Guide workflow)
const TAG_TO_NEXT_SUBCATEGORY: Record<string, string> = {
  'CINEMATIC': 'mood_cinematic',
  'ORCHESTRAL HYBRID': 'mood_cinematic',
  'DARK ELECTRO': 'mood_aggressive',
  'MODERN METAL': 'mood_aggressive',
  'HIP-HOP / TRAP': 'mood_aggressive',
  'PHONK / DRIFT': 'mood_aggressive',
  'INDUSTRIAL BASS': 'mood_aggressive',
  'CYBERPUNK MIDTEMPO': 'mood_aggressive',
  'ALTERNATIVE ROCK': 'mood_emotional',
  'SYNTHWAVE / RETROWAVE': 'mood_emotional',
  'DARK FOLK / ETHNIC': 'mood_cinematic',
  'POST-PUNK / COLDWAVE': 'mood_emotional',
  // Moods -> Styles
  'DARK': 'style_orchestral',
  'HEROIC': 'style_orchestral',
  'EPIC': 'style_orchestral',
  'MONUMENTAL': 'style_orchestral',
  'DRAMATIC': 'style_orchestral',
  'TRAGIC': 'style_orchestral',
  'APOCALYPTIC': 'style_orchestral',
  'DARKENING ATMOSPHERIC': 'style_orchestral',
  'AGGRESSIVE': 'style_electronic',
  'DESPERATE': 'style_band',
  'HAUNTING': 'style_realism',
  'MENACING': 'style_electronic',
  'BRUTAL': 'style_band',
  'MELANCHOLIC': 'style_band',
  'BITTERSWEET': 'style_realism',
  'ANTHEMIC CHORUS': 'style_orchestral',
  // Gear -> Realism
  'EPIPHONE LES PAUL STANDARD': 'style_realism',
  'FENDER AMERICAN TELECASTER': 'style_realism',
  'GRETSCH G5422TG HOLLOWBODY': 'style_realism',
  'ACOUSTIC FINGERPICKING': 'style_realism',
  // Vocals -> Clarity
  'GRITTY VOCALS': 'vocal_fx',
  'DEEP MALE VOCAL': 'vocal_fx',
  'RASPY LEAD VOCAL': 'vocal_fx',
  'AGGRESSIVE RAP FLOW': 'vocal_fx',
  // Pauses & Builds -> Drops
  'BUILDING INTENSITY': 'fx_drops',
  'SUDDEN PAUSE: 1 SEC': 'fx_drops',
  'SUDDEN PAUSE: 2 SEC': 'fx_drops',
  'COMPLETE SILENCE: 1 SEC': 'fx_drops',
  'BREAK . . .': 'fx_drops',
  'BREAK! BREAK! BREAK!': 'fx_drops',
  'TENSION RISER': 'fx_drops',
  'SNARE ROLL BUILD-UP': 'fx_drops',
  'HEAVY SLOW INTRO': 'mood_cinematic',
};

// Micro-modifier cycles when clicking the cycle icon on an existing capsule
const MODIFIER_CYCLES: string[][] = [
  ['Sudden Pause: 1 Sec', 'Sudden Pause: 2 Sec', 'Sudden Pause: 3 Sec'],
  ['Complete Silence: 1 Sec', 'Complete Silence: 2 Sec', 'Complete Silence: 3 Sec'],
  ['Break . . .', 'Break! Break! Break!', 'Sudden Pause: 1 Sec'],
  ['Massive Beat Drop', 'Heavy Bass Drop', 'Subtle Groove Drop'],
  ['Heavy Slow Intro', 'Atmospheric Slow Intro', 'Explosive Fast Intro'],
  ['Building Intensity', 'Snare Roll Build-up', 'Tension Riser'],
  ['Etherealer', 'Etherealing', 'Darkening Atmospheric'],
  ['Epiphone Les Paul Standard', 'Fender American Telecaster', 'Gretsch G5422TG Hollowbody'],
  ['FM Synthesis Bass', 'Warm Reese Bass', 'Heavy TR-808 Sub Bass'],
  ['Broadway Musical Clarity', 'Hyper-Articulated Diction', 'Dry Front-and-Center Lead Vocal'],
  ['Key Change (+1 Semitone)', 'Key Change (+2 Semitones)', 'Tempo Drop (-20 BPM)'],
  ['Whispered Delivery', 'Gritty Vocals', 'Raspy Lead Vocal', 'Aggressive Rap Flow', 'Emotional Belting'],
  ['Deep Male Vocal', 'Powerful Female Vocal', 'Duet Male & Female'],
];

export function getNextModifierVariant(currentLabel: string): string | null {
  const upper = currentLabel.trim().toUpperCase();
  for (const group of MODIFIER_CYCLES) {
    const idx = group.findIndex(item => item.toUpperCase() === upper);
    if (idx !== -1) {
      return group[(idx + 1) % group.length];
    }
  }
  return null;
}

export function getSuggestedSubcategory(
  sectionHeader: string,
  existingChips: MetatagChip[],
  customStore: CustomMetatagStore
): MetatagSubcategory {
  const cleanSection = normalizeSectionToLatin(sectionHeader).replace(/[\[\]]/g, '');

  // If no chips yet, pick smart starting subcategory based on Section type
  if (existingChips.length === 0) {
    if (cleanSection === 'INTRO') {
      return SUNO_SUBCATEGORIES.find(s => s.id === 'fx_transitions') || SUNO_SUBCATEGORIES[0];
    }
    if (cleanSection === 'DROP' || cleanSection === 'BREAKDOWN' || cleanSection === 'END') {
      return SUNO_SUBCATEGORIES.find(s => s.id === 'fx_drops') || SUNO_SUBCATEGORIES[0];
    }
    if (cleanSection === 'BUILD' || cleanSection === 'BREAK') {
      return SUNO_SUBCATEGORIES.find(s => s.id === 'fx_transitions') || SUNO_SUBCATEGORIES[0];
    }
    if (cleanSection === 'SOLO' || cleanSection === 'INSTRUMENTAL') {
      return SUNO_SUBCATEGORIES.find(s => s.id === 'style_band') || SUNO_SUBCATEGORIES[0];
    }
    if (cleanSection === 'CHORUS' || cleanSection === 'HOOK') {
      return SUNO_SUBCATEGORIES.find(s => s.id === 'mood_emotional') || SUNO_SUBCATEGORIES[0];
    }
    return SUNO_SUBCATEGORIES[0]; // genre_core
  }

  const lastChip = existingChips[existingChips.length - 1];
  const lastUpper = lastChip.label.trim().toUpperCase();

  // 1. Check user's learned parent->nextSubcategory link
  const learnedNextId = customStore.parentToNextSubcategory[lastUpper];
  if (learnedNextId) {
    const found = SUNO_SUBCATEGORIES.find(s => s.id === learnedNextId);
    if (found) return found;
  }

  // 2. Check direct tag routing table
  const directNextId = TAG_TO_NEXT_SUBCATEGORY[lastUpper];
  if (directNextId) {
    const found = SUNO_SUBCATEGORIES.find(s => s.id === directNextId);
    if (found) return found;
  }

  // 3. Fallback to current subcategory's nextSubcategoryId
  const currentSub = SUNO_SUBCATEGORIES.find(s => s.id === lastChip.subcategoryId);
  if (currentSub?.nextSubcategoryId) {
    const nextSub = SUNO_SUBCATEGORIES.find(s => s.id === currentSub.nextSubcategoryId);
    if (nextSub) return nextSub;
  }

  return SUNO_SUBCATEGORIES[0];
}

export const DEFAULT_CHAIN_PRESETS: ChainPreset[] = [
  {
    id: 'preset_cinematic_drop',
    name: 'Cinematic Apocalyptic Drop',
    chips: [
      { label: 'Cinematic', category: 'genre', subcategoryId: 'genre_core' },
      { label: 'Dark', category: 'mood', subcategoryId: 'mood_cinematic' },
      { label: 'Apocalyptic', category: 'mood', subcategoryId: 'mood_cinematic' },
      { label: 'Orchestral', category: 'style', subcategoryId: 'style_orchestral' },
      { label: 'Sudden Pause: 1 Sec', category: 'fx', subcategoryId: 'fx_transitions' },
      { label: 'Massive Beat Drop', category: 'fx', subcategoryId: 'fx_drops' },
    ],
  },
  {
    id: 'preset_acoustic_realism',
    name: 'Acoustic Realism + Broadway Diction (Trick #13)',
    chips: [
      { label: 'Close Mic Presence', category: 'style', subcategoryId: 'style_realism' },
      { label: 'Proximity Effect', category: 'style', subcategoryId: 'style_realism' },
      { label: 'Breath Detail', category: 'style', subcategoryId: 'style_realism' },
      { label: 'Pick Noise & Fret Squeak', category: 'style', subcategoryId: 'style_realism' },
      { label: 'Broadway Musical Clarity', category: 'vocal', subcategoryId: 'vocal_fx' },
      { label: 'Hyper-Articulated Diction', category: 'vocal', subcategoryId: 'vocal_fx' },
    ],
  },
  {
    id: 'preset_anti_sawtooth_bass',
    name: 'Anti-Sawtooth Dark Electronic Stack',
    chips: [
      { label: 'Dark Electro', category: 'genre', subcategoryId: 'genre_core' },
      { label: 'FM Synthesis Bass', category: 'style', subcategoryId: 'style_electronic' },
      { label: 'Wavetable Movement', category: 'style', subcategoryId: 'style_electronic' },
      { label: 'Warm Reese Bass', category: 'style', subcategoryId: 'style_electronic' },
      { label: '808 Sidechain Ducking', category: 'style', subcategoryId: 'style_electronic' },
    ],
  },
  {
    id: 'preset_anthemic_chorus',
    name: '95% Hit Anthemic Chorus Stack',
    chips: [
      { label: 'Anthemic Chorus', category: 'mood', subcategoryId: 'mood_emotional' },
      { label: 'Building Intensity', category: 'fx', subcategoryId: 'fx_transitions' },
      { label: 'Epiphone Les Paul Standard', category: 'style', subcategoryId: 'style_band' },
      { label: 'Punishing Drums', category: 'style', subcategoryId: 'style_band' },
      { label: 'Gritty Vocals', category: 'vocal', subcategoryId: 'vocal_delivery' },
      { label: 'Stacked Harmonies', category: 'vocal', subcategoryId: 'vocal_fx' },
    ],
  },
];

export function loadCustomMetatagStore(): CustomMetatagStore {
  try {
    const raw = localStorage.getItem(METATAG_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        customTagsBySubcategory: parsed.customTagsBySubcategory || {},
        parentToNextSubcategory: parsed.parentToNextSubcategory || {},
        parentToCustomTags: parsed.parentToCustomTags || {},
        chainPresets:
          Array.isArray(parsed.chainPresets) && parsed.chainPresets.length > 0
            ? parsed.chainPresets
            : DEFAULT_CHAIN_PRESETS,
        formatMode: parsed.formatMode || 'grouped',
        globalStyleChips: Array.isArray(parsed.globalStyleChips) ? parsed.globalStyleChips : [],
        excludeStyleChips: Array.isArray(parsed.excludeStyleChips) ? parsed.excludeStyleChips : [],
        musicalKey: parsed.musicalKey || 'A Minor',
        lockKeyBpmInStyle: Boolean(parsed.lockKeyBpmInStyle),
        useMaxModeHeader: Boolean(parsed.useMaxModeHeader),
      };
    }
  } catch (e) {
    console.warn('Failed to load custom metatags store:', e);
  }
  return {
    customTagsBySubcategory: {},
    parentToNextSubcategory: {},
    parentToCustomTags: {},
    chainPresets: DEFAULT_CHAIN_PRESETS,
    formatMode: 'grouped',
    globalStyleChips: [],
    excludeStyleChips: [],
    musicalKey: 'A Minor',
    lockKeyBpmInStyle: true,
    useMaxModeHeader: false,
  };
}

export function saveCustomMetatagStore(store: CustomMetatagStore): void {
  try {
    localStorage.setItem(METATAG_STORAGE_KEY, JSON.stringify(store));
  } catch (e) {
    console.warn('Failed to save custom metatags store:', e);
  }
}

export function inferChipFromLabel(label: string): MetatagChip {
  const clean = label.replace(/[\[\]]/g, '').trim();
  const upper = clean.toUpperCase();

  for (const sub of SUNO_SUBCATEGORIES) {
    const match = sub.tags.find(t => t.toUpperCase() === upper);
    if (match) {
      return {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        label: match,
        category: sub.category,
        subcategoryId: sub.id,
      };
    }
  }

  // Heuristic category detection for custom tags
  let category: MetatagCategoryKey = 'style';
  let subcategoryId = 'style_orchestral';
  if (/PAUSE|DROP|SILENCE|INTRO|OUTRO|BUILD|RISER|STOP|FADE|CUT|BREAK|MAX|START_ON|END|SEC\b/i.test(clean)) {
    category = 'fx';
    subcategoryId = /DROP|CLIMAX|FADE|END|MAX/i.test(clean) ? 'fx_drops' : 'fx_transitions';
  } else if (/VOCAL|VOICE|WHISPER|SCREAM|CHOIR|HARMON|CHANT|RAP|BELT|FALSETTO|DICTION|BROADWAY/i.test(clean)) {
    category = 'vocal';
    subcategoryId = 'vocal_delivery';
  } else if (/DARK|EPIC|HEROIC|TRAGIC|DRAMATIC|MOOD|MELANCHOL|AGGRESSIVE|APOCALYPTIC|DESPERATE|HAUNTING|BITTERSWEET|ANTHEMIC|ETHEREAL/i.test(clean)) {
    category = 'mood';
    subcategoryId = 'mood_cinematic';
  } else if (/CINEMATIC|ROCK|METAL|TRAP|PHONK|TECHNO|FOLK|POP|EDM/i.test(clean)) {
    category = 'genre';
    subcategoryId = 'genre_core';
  }

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    label: clean,
    category,
    subcategoryId,
    isCustom: true,
  };
}

// Formats an array of chips into the bracketed uppercase line placed right under [SECTION]
export function formatMetatagLine(
  chips: MetatagChip[],
  mode: MetatagFormatMode = 'grouped'
): string {
  if (!chips || chips.length === 0) return '';

  const upperLabels = chips.map(c => c.label.replace(/[\[\]]/g, '').trim().toUpperCase()).filter(Boolean);
  if (upperLabels.length === 0) return '';

  if (mode === 'pipes') {
    return `[${upperLabels.join(' | ')}]`;
  }

  if (mode === 'separate') {
    return upperLabels.map(l => `[${l}]`).join(' ');
  }

  // 'grouped' (Default): Groups style/mood descriptors together and keeps standalone action/pause directives in their own brackets
  const styleMoodVocal: string[] = [];
  const actions: string[] = [];

  chips.forEach(chip => {
    const clean = chip.label.replace(/[\[\]]/g, '').trim().toUpperCase();
    if (!clean) return;
    if (chip.category === 'fx') {
      actions.push(`[${clean}]`);
    } else {
      styleMoodVocal.push(clean);
    }
  });

  const parts: string[] = [];
  if (styleMoodVocal.length > 0) {
    parts.push(`[${styleMoodVocal.join(', ')}]`);
  }
  parts.push(...actions);

  return parts.join(' ');
}

// Parses a bracketed metatag line like "[CINEMATIC, DARK, ORCHESTRAL] [SUDDEN PAUSE: 1 SEC]" into chips
export function parseMetatagLineToChips(line: string): MetatagChip[] {
  if (!line || !line.trim()) return [];
  const bracketMatches = line.match(/\[([^\]]+)\]/g);
  const tokens: string[] = [];

  if (bracketMatches && bracketMatches.length > 0) {
    bracketMatches.forEach(group => {
      const inner = group.slice(1, -1);
      inner.split(/\s*[|,]\s*/).forEach(piece => {
        const trimmed = piece.trim();
        if (trimmed) tokens.push(trimmed);
      });
    });
  } else {
    line.split(/\s*[|,]\s*/).forEach(piece => {
      const trimmed = piece.trim();
      if (trimmed) tokens.push(trimmed);
    });
  }

  return tokens.map(t => inferChipFromLabel(t));
}

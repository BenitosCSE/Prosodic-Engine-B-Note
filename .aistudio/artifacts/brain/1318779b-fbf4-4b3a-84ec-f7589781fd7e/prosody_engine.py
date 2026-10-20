#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
B-NoTe Prosodic Acoustic Engine — Python Core Implementation
===========================================================

Autonomous Python 3.10+ reference module for Ukrainian phonetic, prosodic,
biomechanical, and metric analysis in poetry, rap, and vocal music.

Directly implements:
  - G2P Ukrainian phonological normalization (assimilations, cluster simplification)
  - Sonority-based syllabification (SSP) with cross-word sandhi
  - Morphologically-driven stress resolution and clitic deaccentuation
  - Level 2 Biomechanical articulatory cluster transition load
  - Stress-anchored rhythmic grid with anacrusis (pickup) detection
  - Poetic & rap meter classifier (Iamb, Trochee, Dactyl, Amphibrach, Anapest, Dolnik)
  - Acoustic singability, consonant complexity, and BPMmax calculations
  - Phonetic rhyme clause extraction and exact/assonance matcher
"""

from __future__ import annotations

import re
import math
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Optional, Set, Literal

# ============================================================================
# 1. PHONETIC SETS & CONSTANTS
# ============================================================================

VOWELS: Set[str] = {
    "а", "е", "є", "и", "і", "ї", "о", "у", "ю", "я",
    "a", "e", "i", "o", "u", "y"
}

CONSONANTS: Set[str] = {
    "б", "в", "г", "ґ", "д", "ж", "з", "й", "к", "л", "м", "н",
    "п", "р", "с", "т", "ф", "х", "ц", "ч", "ш", "щ",
    "b", "c", "d", "f", "g", "h", "j", "k", "l", "m", "n",
    "p", "q", "r", "s", "t", "v", "w", "x", "z"
}

SONORANTS: Set[str] = {"р", "л", "м", "н", "й", "в", "r", "l", "m", "n", "w", "j"}
GLIDES: Set[str] = {"в", "й", "w", "j", "ў", "і̯"}
PLOSIVES: Set[str] = {"п", "б", "т", "д", "к", "ґ", "p", "b", "t", "d", "k", "g"}
SIBILANTS: Set[str] = {"ж", "ч", "ш", "щ", "ц", "з", "с", "s", "z", "x"}

OPEN_RESONANT_VOWELS: Set[str] = {"а", "я", "о", "a", "o"}
FAST_NARROW_VOWELS: Set[str] = {"і", "ї", "и", "у", "ю", "i", "u", "y"}
IOTATED: Set[str] = {"я", "ю", "є"}
APOSTROPHES: Set[str] = {"'", "’", "ʼ", "‘", "`"}

# Biomechanical constants
Kh: float = 0.25  # Base consonant cluster step penalty
Gh: float = 0.15  # Coda closure penalty
Xh: float = 0.10  # Openness bonus
Zh: float = 6.00  # Physiological neutral articulatory limit (syllables/sec)


# ============================================================================
# 2. DATA STRUCTURES
# ============================================================================

@dataclass
class Syllable:
    text: str
    full_text: str
    is_word: bool
    closed: bool
    glide_closed: bool = False
    openness_score: float = 1.0
    articulatory_load: float = 0.0
    vowel_code: str = ""
    consonants: int = 0
    stressed: bool = False
    misstress: bool = False
    is_anacrusis: bool = False
    beat_index: Optional[int] = None
    subdivision_index: Optional[int] = None


@dataclass
class Segment:
    type: Literal["word", "separator"]
    text: str
    syllables: List[Syllable] = field(default_factory=list)
    pause_weight: float = 0.0


@dataclass
class ProsodyMetrics:
    S: int                         # Total syllable count
    S_eff: float                   # Effective syllable count (weighted with pauses)
    O: float                       # Acoustic openness (0.0 .. 1.0)
    Cavg: float                    # Average consonants per syllable
    SD: float                      # Syllable density per musical beat
    r: float                       # Current articulation rate (syllables/sec)
    r_max: float                   # Safe maximum recommended rate
    BPM_max: float                 # Maximum recommended tempo before articulatory breakdown
    A: float                       # Stress-to-grid alignment accuracy (0.0 .. 1.0)
    singability: float             # 0 - 100 %
    complexity: float              # 0 - 100 %
    meter_name: str                # Poetic/rap meter name (Ямб, Хорей, Дольник тощо)
    scheme: str                    # Visual scheme (e.g., "— ∪ — ∪")
    rhyme_signature: str           # Extracted phonetic rhyme clause
    anacrusis: int                 # Pickup syllable count before the downbeat
    pause_count: int               # Count of caesuras and punctuation pauses
    segments: List[Segment] = field(default_factory=list)
    syllables: List[Syllable] = field(default_factory=list)


# ============================================================================
# 3. PHONOLOGICAL & G2P ROUTINES
# ============================================================================

def is_vowel(char: str) -> bool:
    """Checks if character is a recognized vowel."""
    return bool(char and char[0].lower() in VOWELS)


def split_graphemes(text: str) -> List[str]:
    """
    Splits string into grapheme clusters, preserving combining acute accent
    U+0301 attached to its base vowel.
    """
    graphemes: List[str] = []
    i = 0
    length = len(text)
    while i < length:
        cluster = text[i]
        while i + 1 < length and text[i + 1] == "\u0301":
            cluster += "\u0301"
            i += 1
        graphemes.append(cluster)
        i += 1
    return graphemes


def normalize_ukrainian_phonetics(text_lower: str) -> str:
    """
    Level 1 G2P Normalization:
    Removes orthographic silent consonant clusters and reflexive verbal assimilations
    in authentic Ukrainian pronunciation so they do not inflate articulatory load.
    """
    s = text_lower.replace("\u0301", "")
    # Reflexive verb endings
    s = s.replace("ться", "ця")
    s = s.replace("шся", "ся")
    # Living Ukrainian cluster assimilations
    s = s.replace("стн", "сн")
    s = s.replace("здн", "зн")
    s = s.replace("стл", "сл")
    s = s.replace("нтськ", "нськ")
    s = s.replace("стськ", "ськ")
    s = s.replace("рдц", "рц")
    s = s.replace("лнц", "нц")
    return s


def analyze_syllable_phonetics(
    syl_lower: str,
    prev_char_before_syl: Optional[str] = None
) -> Tuple[int, float, str]:
    """
    Extracts phonetic consonant count, biomechanical transition load, and core vowel.
    Accounts for affricates (дж, дз) as single phonemes and muta cum liquida.
    """
    normalized = normalize_ukrainian_phonetics(syl_lower)
    phones: List[str] = []
    vowel_char = "а"

    i = 0
    n = len(normalized)
    while i < n:
        ch = normalized[i]
        if ch in VOWELS:
            vowel_char = ch

        if ch == "щ":
            phones.extend(["ш", "ч"])
        elif ch == "ї":
            phones.append("й")
        elif ch in IOTATED:
            prev = prev_char_before_syl if i == 0 else normalized[i - 1]
            if not prev or prev in VOWELS or prev in APOSTROPHES or prev == "ь":
                phones.append("й")
        elif ch in CONSONANTS:
            # Affricate digraphs дж / дз act as 1 phoneme
            if ch == "д" and i + 1 < n and normalized[i + 1] in ("ж", "з"):
                phones.append(ch + normalized[i + 1])
                i += 1
            else:
                phones.append(ch)
        i += 1

    count = len(phones)
    if count == 0:
        return 0, 0.0, vowel_char

    # First consonant in onset is natural; penalty applies to complex clusters
    articulatory_load = 0.0
    for idx in range(1, len(phones)):
        prev = phones[idx - 1]
        curr = phones[idx]

        prev_is_obstruent = (prev in PLOSIVES or prev in SIBILANTS or prev in ("дж", "дз"))
        curr_is_sonorant = (curr in SONORANTS or curr in GLIDES)
        prev_is_sonorant = (prev in SONORANTS or prev in GLIDES)
        curr_is_obstruent = (curr in PLOSIVES or curr in SIBILANTS or curr in ("дж", "дз"))

        if prev_is_obstruent and curr_is_sonorant:
            # Muta cum liquida (пр, тр, кр, пл, бл, кл, сл, зн)
            articulatory_load += 0.12
        elif prev_is_sonorant and curr_is_obstruent:
            # Sonorant to obstruent descent (рт, лк, нк, мп)
            articulatory_load += 0.18
        elif prev_is_obstruent and curr_is_obstruent:
            # Heavy obstruent/sibilant clash (кт, пт, гд, тч, сш, зж, стк)
            articulatory_load += 0.36
        else:
            articulatory_load += Kh

    return count, articulatory_load, vowel_char


def evaluate_syllable_closure(syl_lower: str) -> Tuple[bool, bool, float]:
    """
    Evaluates syllable coda closure:
    Returns (closed, glide_closed, openness_score).
    """
    clean = re.sub(r"[\u0301'’ʼ‘`ь]", "", syl_lower)
    if not clean:
        return False, False, 1.0

    last_char = clean[-1]
    if last_char not in CONSONANTS:
        return False, False, 1.0

    # Bilabial [ў] ('в') and palatal [і̯] ('й') vocalize into glides at coda
    if last_char in GLIDES:
        return False, True, 0.85

    # Sonorants (м, н, л, р) carry partial voicing
    if last_char in SONORANTS:
        return True, False, 0.35

    return True, False, 0.0


# ============================================================================
# 4. MORPHOLOGICAL STRESS HEURISTIC
# ============================================================================

def detect_stress(word: str) -> int:
    """
    Morphologically-informed statistical stress heuristic for Ukrainian words.
    Returns 0-based vowel index of the stressed syllable.
    """
    word_clean = re.sub(r"[\u0301'’ʼ‘`]", "", word.lower())
    vowel_positions = [i for i, ch in enumerate(word_clean) if ch in VOWELS]
    n = len(vowel_positions)

    if n <= 1:
        return 0

    # 1. Prefix "ви-" in verbs/nouns often attracts stress to the 1st syllable
    if (word_clean.startswith("ви") and n >= 2 and
            (word_clean.endswith("ти") or word_clean.endswith("в") or
             word_clean.endswith("ла") or word_clean.endswith("ли"))):
        return 0

    # 2. Past tense & finite verb suffixes with final stress
    if (word_clean.endswith(("ив", "их", "ов", "ла", "ло", "ли", "имо", "ете", "узь")) or
            (not word_clean.endswith("ання") and word_clean.endswith(("тя", "ття")))):
        return n - 1

    # 3. Verbal nouns on -ння, -ість, -увати (penultimate stress)
    if word_clean.endswith(("ння", "ість", "увати", "ювати")):
        return max(0, n - 2)

    # 4. Adjectives on -ський, -цький, -зький
    if word_clean.endswith(("ський", "цький", "зький", "ська", "цька", "зька")):
        return max(0, n - 2)

    # 5. Standard statistical defaults
    if n == 2:
        return 0
    if n == 3:
        return 1

    return max(0, n - 2)


# ============================================================================
# 5. BIOMECHANICAL SYLLABLE WEIGHT
# ============================================================================

def get_syllable_weight(syllable: Syllable) -> float:
    """
    Calculates physiological biomechanical duration weight of a syllable.
    """
    if not syllable.is_word:
        return 0.0

    openness = syllable.openness_score
    closed_weight = 1.0 - openness
    open_weight = openness

    stress_weight = 1.45 if (syllable.stressed and not syllable.misstress) else 1.0
    cluster_load = syllable.articulatory_load

    vowel_mod = -0.05 if (syllable.vowel_code in FAST_NARROW_VOWELS) else 0.0
    weight = stress_weight + cluster_load + Gh * closed_weight - Xh * open_weight + vowel_mod
    return max(0.5, weight)


# ============================================================================
# 6. METER DETECTION & RHYME EXTRACTION
# ============================================================================

def detect_meter_and_scheme(syllables: List[Syllable]) -> Tuple[str, str]:
    """
    Detects classical poetic or rap meter and constructs metric scheme (— ∪).
    """
    n = len(syllables)
    if n == 0:
        return "—", ""

    pattern = [1 if s.stressed else 0 for s in syllables]
    scheme = " ".join("—" if p == 1 else "∪" for p in pattern)

    if n < 2:
        return "Односклад", scheme

    stressed_indices = [i for i, p in enumerate(pattern) if p == 1]
    if not stressed_indices:
        return "Пірихій", scheme

    meters = [
        {"name": "Хорей", "period": 2, "offset": 0},
        {"name": "Ямб", "period": 2, "offset": 1},
        {"name": "Дактиль", "period": 3, "offset": 0},
        {"name": "Амфібрахій", "period": 3, "offset": 1},
        {"name": "Анапест", "period": 3, "offset": 2},
    ]

    best_meter = "Дольник"
    best_score = 0.0

    for m in meters:
        hits = sum(1 for idx in stressed_indices if idx % m["period"] == m["offset"])
        score = hits / len(stressed_indices)
        if score > best_score and score >= 0.65:
            best_score = score
            best_meter = m["name"]

    return best_meter, scheme


def extract_rhyme_signature(syllables: List[Syllable]) -> str:
    """
    Extracts the phonetic rhyme clause from the last stressed vowel to the end of the line.
    """
    if not syllables:
        return ""

    last_stressed_idx = -1
    for i in range(len(syllables) - 1, -1, -1):
        if syllables[i].stressed:
            last_stressed_idx = i
            break

    if last_stressed_idx == -1:
        last_stressed_idx = len(syllables) - 1

    raw_tail = "".join(s.text for s in syllables[last_stressed_idx:])
    raw_tail = re.sub(r"[\u0301'’ʼ‘`ь]", "", raw_tail)
    tail_text = normalize_ukrainian_phonetics(raw_tail)

    core_map = {"я": "а", "ю": "у", "є": "е", "ї": "і"}
    for i, ch in enumerate(tail_text):
        if ch in VOWELS:
            first_vowel = core_map.get(ch, ch)
            return first_vowel + tail_text[i + 1:]

    return tail_text


def compare_rhyme_signatures(sig_a: str, sig_b: str) -> Optional[Literal["exact", "assonance"]]:
    """
    Compares two phonetic rhyme signatures.
    Returns 'exact', 'assonance', or None.
    """
    if not sig_a or not sig_b:
        return None

    def norm(s: str) -> str:
        s = s.lower()
        s = s.replace("я", "а").replace("ю", "у").replace("є", "е").replace("ї", "і")
        return re.sub(r"['’ʼ‘`ь]", "", s)

    na = norm(sig_a)
    nb = norm(sig_b)

    if na == nb:
        return "exact"

    vowels_a = [ch for ch in na if ch in VOWELS]
    vowels_b = [ch for ch in nb if ch in VOWELS]

    if vowels_a and len(vowels_a) == len(vowels_b) and vowels_a[0] == vowels_b[0]:
        last_a = na[-1]
        last_b = nb[-1]
        if last_a == last_b or (last_a in VOWELS and last_b in VOWELS):
            return "assonance"
        if len(vowels_a) >= 2 and vowels_a[-1] == vowels_b[-1]:
            return "assonance"

    return None


# ============================================================================
# 7. MAIN ANALYTIC PIPELINE
# ============================================================================

def analyze_text(
    text: str,
    bpm: float = 120.0,
    beats: int = 4,
    dictionary: Optional[Dict[str, int]] = None,
    subdivisions: int = 4
) -> ProsodyMetrics:
    """
    Analyzes an input line of Ukrainian lyrics/poetry.
    """
    dictionary = dictionary or {}
    segments: List[Segment] = []
    all_syllables: List[Syllable] = []
    pause_count = 0
    total_pause_weight = 0.0

    # Tokenizer preserves letters, acute accent \u0301, and apostrophes
    token_pattern = re.compile(r"([^a-zA-Zа-яА-ЯіїєґІЇЄҐ\u0301'’ʼ‘`]+)")
    parts = token_pattern.split(text)

    pending_consonants_from_proclitic = 0
    pending_load_from_proclitic = 0.0
    last_separator_had_pause = False

    letter_check = re.compile(r"[a-zA-Zа-яА-ЯіїєґІЇЄҐ]")

    for part in parts:
        if not part:
            continue

        if not letter_check.search(part):
            # Punctuation / Caesura separator
            pause_weight = 0.0
            if re.search(r"[—–…]|\.\.\.", part):
                pause_weight = 0.5
                pause_count += 1
            elif re.search(r"[,;:!?]", part):
                pause_weight = 0.25
                pause_count += 1

            total_pause_weight += pause_weight
            last_separator_had_pause = pause_weight > 0

            segments.append(Segment(
                type="separator",
                text=part,
                pause_weight=pause_weight,
                syllables=[Syllable(
                    text=part,
                    full_text=part,
                    is_word=False,
                    closed=False,
                    consonants=0,
                    stressed=False,
                    misstress=False
                )]
            ))
        else:
            syllables: List[Syllable] = []
            graphemes = split_graphemes(part)

            # 1. Locate vowels and explicit acute accent \u0301
            stress_idx: Optional[int] = None
            vowel_grapheme_indices: List[int] = []

            for idx, g in enumerate(graphemes):
                base = g[0].lower()
                if base in VOWELS:
                    if "\u0301" in g:
                        stress_idx = len(vowel_grapheme_indices)
                    vowel_grapheme_indices.append(idx)

            clean_word = part.lower().replace("\u0301", "")
            for ap in ("’", "ʼ", "‘", "`"):
                clean_word = clean_word.replace(ap, "'")

            # 2. Dictionary lookup
            if stress_idx is None:
                if clean_word in dictionary:
                    stress_idx = dictionary[clean_word]

            # 3. Morphological fallback
            if stress_idx is None and vowel_grapheme_indices:
                stress_idx = detect_stress(clean_word)

            if stress_idx is not None and vowel_grapheme_indices:
                stress_idx = max(0, min(len(vowel_grapheme_indices) - 1, stress_idx))

            # Handle vowelless proclitics/enclitics ("в", "з", "ж", "б")
            if not vowel_grapheme_indices:
                cons_count, _, _ = analyze_syllable_phonetics(clean_word)
                if all_syllables and clean_word in ("ж", "б"):
                    prev_s = all_syllables[-1]
                    prev_s.consonants += cons_count
                    prev_s.articulatory_load += 0.18
                    prev_s.closed = True
                    prev_s.openness_score = 0.0
                else:
                    pending_consonants_from_proclitic += cons_count
                    pending_load_from_proclitic += 0.12

                syl_obj = Syllable(
                    text=clean_word,
                    full_text=part,
                    is_word=False,
                    closed=False,
                    consonants=cons_count,
                    stressed=False,
                    misstress=False
                )
                syllables.append(syl_obj)
                segments.append(Segment(type="word", text=part, syllables=syllables))
                continue

            # 4. Cross-word Sandhi (Resyllabification)
            starts_with_vowel = (graphemes[0][0].lower() in VOWELS) and (pending_consonants_from_proclitic == 0)
            if starts_with_vowel and not last_separator_had_pause and all_syllables:
                prev_s = all_syllables[-1]
                if prev_s.closed or prev_s.glide_closed:
                    prev_s.closed = False
                    prev_s.glide_closed = False
                    prev_s.openness_score = 0.95

            # Initial 'в' glide vocalization before consonant
            first_ch = graphemes[0][0].lower()
            second_ch = graphemes[1][0].lower() if len(graphemes) > 1 else ""
            initial_v_glide = False
            if (first_ch == "в" and second_ch in CONSONANTS and
                    not last_separator_had_pause and all_syllables and not all_syllables[-1].closed):
                prev_s = all_syllables[-1]
                prev_s.glide_closed = True
                prev_s.openness_score = 0.85
                initial_v_glide = True

            # 5. Ukrainian Phonetic Syllabification (SSP)
            start_g = 0
            total_vowels = len(vowel_grapheme_indices)

            for v_idx in range(total_vowels):
                curr_v_pos = vowel_grapheme_indices[v_idx]
                if v_idx == total_vowels - 1:
                    end_g = len(graphemes)
                else:
                    next_v_pos = vowel_grapheme_indices[v_idx + 1]
                    intervocalic = next_v_pos - curr_v_pos - 1

                    if intervocalic <= 1:
                        end_g = curr_v_pos + 1
                    else:
                        first_after = graphemes[curr_v_pos + 1][0].lower()
                        second_after = graphemes[curr_v_pos + 2][0].lower() if curr_v_pos + 2 < len(graphemes) else ""

                        if first_after == "д" and second_after in ("ж", "з") and intervocalic == 2:
                            end_g = curr_v_pos + 1
                        elif first_after in SONORANTS or first_after == "ь" or first_after in APOSTROPHES:
                            end_g = curr_v_pos + 2
                            if second_after == "ь" or second_after in APOSTROPHES:
                                end_g = min(next_v_pos, curr_v_pos + 3)
                        else:
                            end_g = (curr_v_pos + 2) if intervocalic >= 3 else (curr_v_pos + 1)

                syl_graphemes = graphemes[start_g:end_g]
                syl_full = "".join(syl_graphemes)
                syl_lower = syl_full.lower()
                prev_ch = graphemes[start_g - 1][0].lower() if start_g > 0 else None

                cons_count, art_load, v_char = analyze_syllable_phonetics(syl_lower, prev_ch)

                if v_idx == 0 and initial_v_glide and cons_count > 1:
                    cons_count -= 1
                    art_load = max(0.0, art_load - 0.15)

                if v_idx == 0 and pending_consonants_from_proclitic > 0:
                    cons_count += pending_consonants_from_proclitic
                    art_load += pending_load_from_proclitic
                    pending_consonants_from_proclitic = 0
                    pending_load_from_proclitic = 0.0

                closed, glide_closed, openness = evaluate_syllable_closure(syl_lower)
                has_manual_accent = "\u0301" in syl_full

                # Monosyllabic functional clitics (і, у, а, та, як, що, не, бо, чи, то, за, на, по, до)
                is_clitic = (
                    total_vowels == 1 and
                    not has_manual_accent and
                    len(clean_word) <= 3 and
                    not closed and
                    not glide_closed
                )
                is_stressed = (not is_clitic) and (stress_idx == v_idx)

                syl_obj = Syllable(
                    text=syl_lower,
                    full_text=syl_full,
                    is_word=True,
                    closed=closed,
                    glide_closed=glide_closed,
                    openness_score=openness,
                    articulatory_load=art_load,
                    vowel_code=v_char,
                    consonants=cons_count,
                    stressed=is_stressed,
                    misstress=False
                )
                syllables.append(syl_obj)
                all_syllables.append(syl_obj)
                start_g = end_g

            last_separator_had_pause = False
            segments.append(Segment(type="word", text=part, syllables=syllables))

    S = len(all_syllables)
    safe_beats = max(1, beats)
    safe_subs = max(1, subdivisions)
    detected_anacrusis = 0

    # Level 3: Rhythmic Grid Alignment & Anacrusis Detection
    if S > 0:
        stressed_indices = [idx for idx, s in enumerate(all_syllables) if s.stressed]
        first_stress = stressed_indices[0] if stressed_indices else 0

        candidate_offsets = [0]
        if first_stress == 1:
            candidate_offsets.append(1)
        elif first_stress == 2:
            candidate_offsets.extend([1, 2])

        best_strong_set: Set[int] = set()
        best_hit_score = -1.0
        best_offset = 0

        for offset in candidate_offsets:
            effective_s = max(1, S - offset)
            c_set: Set[int] = set()

            if effective_s <= safe_beats:
                for b in range(safe_beats):
                    idx = offset + min(effective_s - 1, round((b * effective_s) / safe_beats))
                    c_set.add(idx)
            else:
                for b in range(safe_beats):
                    anchor = offset + round((b * effective_s) / safe_beats)
                    if anchor < S:
                        c_set.add(anchor)
                    if effective_s >= safe_beats * 1.5 and safe_subs >= 2:
                        sub_anchor = offset + round(((b + 0.5) * effective_s) / safe_beats)
                        if sub_anchor < S:
                            c_set.add(sub_anchor)

            hits = sum(1 for idx in stressed_indices if idx in c_set)
            score = (hits / len(stressed_indices)) if stressed_indices else 1.0

            if score > best_hit_score:
                best_hit_score = score
                best_strong_set = c_set
                best_offset = offset

        detected_anacrusis = best_offset

        # Check P-center interval regular chain
        is_isochronous = False
        if len(stressed_indices) >= 2:
            intervals = [stressed_indices[k] - stressed_indices[k - 1] for k in range(1, len(stressed_indices))]
            regular = sum(1 for d in intervals if d in (2, 3, 4))
            if regular / len(intervals) >= 0.75:
                is_isochronous = True

        meter_name, _ = detect_meter_and_scheme(all_syllables)
        has_regular_meter = is_isochronous or (meter_name not in ("Дольник", "—", "Пірихій"))
        effective_s = max(1, S - best_offset)

        for i, s in enumerate(all_syllables):
            s.is_anacrusis = (i < best_offset)
            shifted = max(0, i - best_offset)
            exact_pos = (shifted * safe_beats) / effective_s
            s.beat_index = math.floor(exact_pos) % safe_beats
            s.subdivision_index = math.floor((exact_pos * safe_subs) % safe_subs)

            is_on_beat = (i in best_strong_set)
            if s.stressed and not is_on_beat and not has_regular_meter:
                s.misstress = True

    S_eff = sum(get_syllable_weight(s) for s in all_syllables) + total_pause_weight

    total_openness = 0.0
    for s in all_syllables:
        base_open = s.openness_score
        bonus = 0.08 if s.vowel_code in OPEN_RESONANT_VOWELS else 0.0
        total_openness += min(1.0, base_open + bonus)

    total_consonants = sum(s.consonants for s in all_syllables)

    O = (total_openness / S) if S > 0 else 0.0
    Cavg = (total_consonants / S) if S > 0 else 0.0
    SD = (S_eff / safe_beats) if safe_beats > 0 else 0.0
    r = (S_eff * bpm) / (60.0 * safe_beats) if safe_beats > 0 else 0.0

    avg_cluster_load = (sum(s.articulatory_load for s in all_syllables) / S) if S > 0 else 0.0
    r_max = Zh * (1.0 - 1.4 * avg_cluster_load) * (1.0 + 0.25 * (O - 0.5))
    if r_max < 0.5:
        r_max = 0.5

    BPM_max = (r_max * 60.0 * safe_beats) / S_eff if S_eff > 0 else 0.0
    singability = min(100.0, max(0.0, O * 100.0))
    complexity = min(100.0, max(0.0, (Cavg / 2.5) * 100.0))

    stressed_sylls = [s for s in all_syllables if s.stressed]
    correct_stress_count = sum(1 for s in stressed_sylls if not s.misstress)
    A = (correct_stress_count / len(stressed_sylls)) if stressed_sylls else 1.0

    meter_name, scheme = detect_meter_and_scheme(all_syllables)
    rhyme_signature = extract_rhyme_signature(all_syllables)

    return ProsodyMetrics(
        S=S,
        S_eff=round(S_eff, 2),
        O=round(O, 3),
        Cavg=round(Cavg, 2),
        SD=round(SD, 2),
        r=round(r, 2),
        r_max=round(r_max, 2),
        BPM_max=round(BPM_max, 1),
        A=round(A, 2),
        singability=round(singability, 1),
        complexity=round(complexity, 1),
        meter_name=meter_name,
        scheme=scheme,
        rhyme_signature=rhyme_signature,
        anacrusis=detected_anacrusis,
        pause_count=pause_count,
        segments=segments,
        syllables=all_syllables
    )


def apply_accents_to_text(text: str, dictionary: Optional[Dict[str, int]] = None) -> str:
    """
    Applies combining acute accent marks (U+0301) to all detected stressed vowels in the text.
    """
    metrics = analyze_text(text, bpm=120, beats=4, dictionary=dictionary)
    result: List[str] = []

    for seg in metrics.segments:
        if seg.type == "separator":
            result.append(seg.text)
        else:
            word = seg.text
            stressed_idx = next((i for i, s in enumerate(seg.syllables) if s.stressed), -1)

            if stressed_idx != -1 and len(seg.syllables) > 1:
                cur_vowel_idx = 0
                word_chars: List[str] = []
                for i, ch in enumerate(word):
                    word_chars.append(ch)
                    if ch.lower() in VOWELS:
                        if cur_vowel_idx == stressed_idx:
                            if i + 1 >= len(word) or word[i + 1] != "\u0301":
                                word_chars.append("\u0301")
                        cur_vowel_idx += 1
                result.append("".join(word_chars))
            else:
                result.append(word)

    return "".join(result)


# ============================================================================
# 8. CLI / DEMO TEST HARNESS
# ============================================================================

if __name__ == "__main__":
    print("=" * 80)
    print(" B-NoTe Prosodic Acoustic Engine — Python Core Verification")
    print("=" * 80)

    sample_lines = [
        ("Реве та стогне Дніпр широкий", 90, 4),
        ("Сердитий вітер завива", 90, 4),
        ("І на оновленій землі врага не буде супостата", 110, 4),
        ("У каламутній воді ми шукаємо чистий голос", 130, 4),
        ("Ніч яка місячна, ясна, зоряна", 85, 3),
        ("Він іде крізь темряву вперед", 125, 4),
    ]

    for line, bpm, beats in sample_lines:
        res = analyze_text(line, bpm=bpm, beats=beats)
        print(f"\n[Текст] {line}")
        print(f" • Склади: {res.S} (S_eff: {res.S_eff}) | Затакт: +{res.anacrusis}")
        print(f" • Розмір: {res.meter_name} [{res.scheme}]")
        print(f" • Співучість: {res.singability}% | Складність: {res.complexity}%")
        print(f" • BPM max: {res.BPM_max} BPM (Поточний: {bpm} BPM)")
        print(f" • Точність сітки A: {int(res.A * 100)}% | Рима: -{res.rhyme_signature}")

    # Rhyme Matcher test
    print("\n" + "-" * 80)
    print(" Римовий тест (Phonetic Rhyme Matcher):")
    sig1 = analyze_text("Дніпр широкий").rhyme_signature
    sig2 = analyze_text("вітер високий").rhyme_signature
    sig3 = analyze_text("глибокий").rhyme_signature
    print(f" 'широкий' (-{sig1}) vs 'високий' (-{sig2}) -> {compare_rhyme_signatures(sig1, sig2)}")
    print(f" 'широкий' (-{sig1}) vs 'глибокий' (-{sig3}) -> {compare_rhyme_signatures(sig1, sig3)}")
    print("=" * 80)

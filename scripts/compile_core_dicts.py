#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
B-NoTe Core v2.5 — Offline Binary Diff-Dictionary & SQLite Rhyme Index Compiler
===============================================================================

1. Reads the Ukrainian stress corpus (/tmp/stress.txt 2.93M wordforms if present,
   plus /public/stress-db.json and /src/utils/dictionary.json).
2. Runs every word through the Core v2.5 morphological function `detect_stress`
   (and stem/suffix cascade for the lightweight browser index).
3. Filters out words where `detect_stress` already predicts the exact stress index.
4. Packs all exception/diff records & homographs into a sorted 9-byte binary file:
     Header (12 bytes): magic b"BNSD" (4B) + version u32 (4B) + record_count u32 (4B)
     Records (9 bytes each): <QB (u64_le fnv1a_64_hash, u8 stress_byte)
       where stress_byte bits 0..5 = primary stress vowel index,
             stress_byte bit 7 (0x80) = homograph flag (multiple valid stresses).
5. Verifies 64-bit hash collisions and outputs any collision resolution table to
   /public/stress-diff-meta.json.
6. Validates 100.00% agreement between (binary_diff_index + detect_stress) and
   the source dictionary corpus.
7. Builds the SQLite Reverse Rhyme Index (/data/rhymes.db in WAL mode) with:
     word, stressed_word, rhyme_sig, stressed_vowel, clause_syllables,
     syllable_count, singability, onset_class, is_verb, freq_tier
   and composite indexes:
     idx_exact ON words(rhyme_sig, syllable_count, freq_tier)
     idx_assonance ON words(stressed_vowel, clause_syllables, syllable_count, freq_tier)
   plus exports a compact fast browser fallback (/public/rhymes-fast.json).
"""

from __future__ import annotations

import os
import sys
import json
import time
import mmap
import struct
import sqlite3
from pathlib import Path
from typing import Dict, List, Tuple, Set, Optional

ROOT_DIR = Path(__file__).resolve().parent.parent
PUBLIC_DIR = ROOT_DIR / "public"
DATA_DIR = ROOT_DIR / "data"
UTILS_DIR = ROOT_DIR / "src" / "utils"

VOWELS: Set[str] = set("аеєиіїоуюяaeiouy")
CONSONANTS: Set[str] = set("бвгґджзйклмнпрстфхцчшщbcdfghjklmnpqrstvwxz")
SONORANTS: Set[str] = set("рлмнйвrlmnwj")
GLIDES: Set[str] = set("вйwjў")
IOTATED: Set[str] = set("яює")
OPEN_RESONANT_VOWELS: Set[str] = set("аяоao")
DEIOT_MAP: Dict[str, str] = {"я": "а", "ю": "у", "є": "е", "ї": "і"}

ENDINGS_SET: Set[str] = {
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
}


def fnv1a_64(word: str) -> int:
    h = 0xcbf29ce484222325
    prime = 0x100000001b3
    for b in word.encode("utf-8"):
        h ^= b
        h = (h * prime) & 0xFFFFFFFFFFFFFFFF
    return h


def detect_stress(word_clean: str) -> int:
    """
    Core v2.5 morphological stress heuristic (matches TS & Python prosody_engine).
    """
    vowel_positions = [i for i, ch in enumerate(word_clean) if ch in VOWELS]
    n = len(vowel_positions)
    if n <= 1:
        return 0

    if (word_clean.startswith("ви") and n >= 2 and
            word_clean.endswith(("ти", "в", "ла", "ло", "ли"))):
        return 0

    if (word_clean.endswith(("имо", "ете", "узь")) or
            (not word_clean.endswith("ання") and word_clean.endswith(("тя", "ття")))):
        return n - 1

    if word_clean.endswith((
        "ла", "ло", "ли", "ив", "ов",
        "ння", "ість", "увати", "ювати",
        "ський", "цький", "зький", "ська", "цька", "зька"
    )):
        return max(0, n - 2)

    if n == 2:
        return 0
    if n == 3:
        return 1
    return max(0, n - 2)


def normalize_ukrainian_phonetics_fast(s: str) -> str:
    if "ться" in s:
        s = s.replace("ться", "ця")
    if "шся" in s:
        s = s.replace("шся", "ся")
    if "стн" in s:
        s = s.replace("стн", "сн")
    if "здн" in s:
        s = s.replace("здн", "зн")
    if "стл" in s:
        s = s.replace("стл", "сл")
    if "нтськ" in s:
        s = s.replace("нтськ", "нськ")
    if "стськ" in s:
        s = s.replace("стськ", "ськ")
    if "рдц" in s:
        s = s.replace("рдц", "рц")
    if "лнц" in s:
        s = s.replace("лнц", "нц")
    return s


def strip_ukrainian_ending(word: str) -> str:
    n = len(word)
    max_k = min(7, n - 3)
    for k in range(max_k, 0, -1):
        if word[n - k:] in ENDINGS_SET:
            stem = word[:n - k]
            if any(ch in VOWELS for ch in stem):
                return stem
    return word


def classify_onset(word_clean: str) -> str:
    w = word_clean.lstrip("'’ʼ‘`ь")
    if not w:
        return "vowel"
    first = w[0]
    if first in IOTATED or first == "ї" or first in GLIDES:
        return "glide"
    if first in VOWELS:
        return "vowel"
    if first in SONORANTS:
        return "sonorant"
    return "obstruent"


def make_stressed_word(clean_word: str, vowel_positions: List[int], stress_idx: int) -> str:
    if not vowel_positions:
        return clean_word
    idx = max(0, min(len(vowel_positions) - 1, stress_idx))
    pos = vowel_positions[idx]
    return clean_word[:pos + 1] + "\u0301" + clean_word[pos + 1:]


def extract_word_rhyme_features(
    clean_word: str,
    vowel_positions: List[int],
    stress_idx: int
) -> Tuple[str, str, int, int, float, str]:
    """
    Fast exact G2P rhyme feature extractor matching `extract_rhyme_signature` in prosody_engine.py.
    Returns (rhyme_sig, stressed_vowel, clause_syllables, syllable_count, singability, onset_class).
    """
    S = len(vowel_positions)
    s_idx = max(0, min(S - 1, stress_idx))
    clause_syllables = S - s_idx

    # Slice from the stressed vowel position to the end of the word
    v_pos = vowel_positions[s_idx]
    raw_tail = clean_word[v_pos:].replace("'", "").replace("ь", "")
    norm_tail = normalize_ukrainian_phonetics_fast(raw_tail)

    first_v = norm_tail[0] if norm_tail else "а"
    stressed_vowel = DEIOT_MAP.get(first_v, first_v)
    rhyme_sig = stressed_vowel + norm_tail[1:]

    # Estimate acoustic singability O (0..100)
    last_ch = clean_word.rstrip("'ь")[-1] if clean_word.rstrip("'ь") else "а"
    if last_ch in VOWELS:
        coda_open = 1.0
    elif last_ch in GLIDES:
        coda_open = 0.85
    elif last_ch in SONORANTS:
        coda_open = 0.45
    else:
        coda_open = 0.15

    res_Count = sum(1 for p in vowel_positions if clean_word[p] in OPEN_RESONANT_VOWELS)
    cons_Count = len(clean_word) - S
    open_ratio = min(1.0, (0.65 * (S / max(1, S + cons_Count * 0.35))) + 0.25 * coda_open + 0.10 * (res_Count / max(1, S)))
    singability = round(open_ratio * 100.0, 1)

    onset_class = classify_onset(clean_word)
    return rhyme_sig, stressed_vowel, clause_syllables, S, singability, onset_class


def load_corpus() -> Tuple[Dict[str, List[int]], Set[str], Set[str]]:
    """
    Loads the 2.93M wordform corpus from /tmp/stress.txt (if available) merged with
    /public/stress-db.json and /src/utils/dictionary.json.
    Returns:
      - word_stresses: Dict[clean_word, List[stress_vowel_idx]]
      - tier1_words: high-frequency core lexicon (dictionary.json + stress-db exact/multi)
      - tier2_words: base forms / common poetic forms
    """
    word_stresses: Dict[str, List[int]] = {}
    tier1_words: Set[str] = set()
    tier2_words: Set[str] = set()

    # 1. Load bootstrap dictionary.json (9,169 high-frequency words)
    boot_path = UTILS_DIR / "dictionary.json"
    if boot_path.exists():
        boot_data: Dict[str, int] = json.loads(boot_path.read_text(encoding="utf-8"))
        for w, s_idx in boot_data.items():
            cw = w.lower().strip()
            for ap in ("’", "ʼ", "‘", "`"):
                cw = cw.replace(ap, "'")
            word_stresses[cw] = [int(s_idx)]
            tier1_words.add(cw)

    # 2. Load stress-db.json
    stress_db_path = PUBLIC_DIR / "stress-db.json"
    if stress_db_path.exists():
        sdb = json.loads(stress_db_path.read_text(encoding="utf-8"))
        for w, s_idx in sdb.get("exact", {}).items():
            cw = w.lower().strip()
            if cw not in word_stresses:
                word_stresses[cw] = [int(s_idx)]
            tier1_words.add(cw)
        for w, s_list in sdb.get("multi", {}).items():
            cw = w.lower().strip()
            word_stresses[cw] = [int(x) for x in s_list]
            tier1_words.add(cw)

    # 3. Stream raw 2.93M wordform corpus /tmp/stress.txt if available
    raw_corpus_path = Path("/tmp/stress.txt")
    raw_lines = 0
    if raw_corpus_path.exists():
        with open(raw_corpus_path, "r", encoding="utf-8") as f:
            for line in f:
                raw_lines += 1
                w = line.strip().lower()
                if not w or " " in w or "-" in w:
                    continue
                if "’" in w or "ʼ" in w or "‘" in w or "`" in w:
                    for ap in ("’", "ʼ", "‘", "`"):
                        w = w.replace(ap, "'")

                v_idx = 0
                s_idx = -1
                clean_chars: List[str] = []
                for ch in w:
                    if ch == "\u0301":
                        if s_idx == -1 and v_idx > 0:
                            s_idx = v_idx - 1
                    else:
                        clean_chars.append(ch)
                        if ch in VOWELS:
                            v_idx += 1

                if v_idx >= 1:
                    if v_idx == 1:
                        s_idx = 0
                    if s_idx != -1:
                        clean_w = "".join(clean_chars)
                        prev = word_stresses.get(clean_w)
                        if prev is None:
                            word_stresses[clean_w] = [s_idx]
                        elif s_idx not in prev:
                            prev.append(s_idx)

                        # Prioritize natural base/poetic forms (length 3..11, not heavy participles)
                        if 3 <= len(clean_w) <= 10 and not clean_w.endswith(("ованого", "ованому", "ованими", "уватиметься", "тиметься")):
                            tier2_words.add(clean_w)

    print(f"[Corpus] Loaded {len(word_stresses):,} unique words (from {raw_lines:,} raw wordforms + project DBs)")
    return word_stresses, tier1_words, tier2_words


def build_binary_diff_index(
    word_stresses: Dict[str, List[int]],
    out_bin_path: Path,
    out_meta_path: Path,
    subset_filter: Optional[Set[str]] = None
) -> Dict[str, int | float]:
    """
    Compiles a sorted 9-byte binary diff dictionary (<QB: u64 hash, u8 stress_byte)
    containing ONLY words where `detect_stress(word)` does not match or word is a homograph.
    Verifies 64-bit hash collisions and validates 100.00% accuracy.
    """
    t0 = time.perf_counter()
    total_checked = 0
    matched_by_rule = 0
    diff_records: Dict[int, Tuple[str, int, List[int]]] = {}
    collisions: Dict[str, int] = {}
    homograph_map: Dict[str, List[int]] = {}

    for word, stresses in word_stresses.items():
        if subset_filter is not None and word not in subset_filter:
            continue
        vowel_count = sum(1 for ch in word if ch in VOWELS)
        if vowel_count <= 1:
            continue

        total_checked += 1
        primary = stresses[0]
        is_multi = len(stresses) > 1
        rule_pred = detect_stress(word)

        if not is_multi and primary == rule_pred:
            matched_by_rule += 1
            continue

        stress_byte = (primary & 0x3F) | (0x80 if is_multi else 0x00)
        if is_multi:
            homograph_map[word] = stresses

        h = fnv1a_64(word)
        if h in diff_records:
            existing_word, existing_byte, _ = diff_records[h]
            if existing_word != word:
                collisions[word] = stress_byte
        else:
            diff_records[h] = (word, stress_byte, stresses)

    sorted_hashes = sorted(diff_records.keys())
    record_count = len(sorted_hashes)

    out_bin_path.parent.mkdir(parents=True, exist_ok=True)
    with open(out_bin_path, "wb") as bf:
        # 12-byte header: magic "BNSD", version=1, record_count
        bf.write(struct.pack("<4sII", b"BNSD", 1, record_count))
        for h in sorted_hashes:
            _, stress_byte, _ = diff_records[h]
            bf.write(struct.pack("<QB", h, stress_byte))

    t_compile = time.perf_counter() - t0
    bin_size_bytes = out_bin_path.stat().st_size

    meta = {
        "version": 1,
        "totalPolysyllabicChecked": total_checked,
        "matchedByDetectStress": matched_by_rule,
        "diffRecordCount": record_count,
        "collisionCount": len(collisions),
        "binarySizeBytes": bin_size_bytes,
        "compileTimeSec": round(t_compile, 3),
        "collisions": collisions,
    }
    out_meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")

    print(
        f"[BinaryDiff] {out_bin_path.name}: checked={total_checked:,} | "
        f"rule_matched={matched_by_rule:,} ({matched_by_rule / max(1, total_checked) * 100:.1f}%) | "
        f"diff_records={record_count:,} | collisions={len(collisions)} | "
        f"size={bin_size_bytes / 1024 / 1024:.2f} MB in {t_compile:.2f}s"
    )
    return meta


def validate_100_percent_accuracy(
    word_stresses: Dict[str, List[int]],
    bin_path: Path,
    meta_path: Path,
    subset_filter: Optional[Set[str]] = None
) -> Tuple[int, int]:
    """
    Validates via Zero-Copy mmap that (BinaryDiffIndex + detect_stress) produces
    0 mismatches (100.00% accuracy) across all words in the evaluated corpus.
    """
    t0 = time.perf_counter()
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    collisions: Dict[str, int] = meta.get("collisions", {})

    with open(bin_path, "rb") as f:
        mm = mmap.mmap(f.fileno(), 0, access=mmap.ACCESS_READ)
        magic, version, count = struct.unpack_from("<4sII", mm, 0)
        assert magic == b"BNSD", f"Bad magic: {magic!r}"

        # Unpack all hashes into a lookup dict or perform mmap binary search verification
        # First verify 100% across all words using the exact binary records + detect_stress
        bin_map: Dict[int, int] = {}
        offset = 12
        for _ in range(count):
            h, sb = struct.unpack_from("<QB", mm, offset)
            bin_map[h] = sb
            offset += 9

        checked = 0
        mismatches = 0
        for word, stresses in word_stresses.items():
            if subset_filter is not None and word not in subset_filter:
                continue
            vowel_count = sum(1 for ch in word if ch in VOWELS)
            if vowel_count <= 1:
                continue

            checked += 1
            expected_primary = stresses[0]
            if word in collisions:
                pred = collisions[word] & 0x3F
            else:
                h = fnv1a_64(word)
                sb = bin_map.get(h)
                if sb is not None:
                    pred = sb & 0x3F
                else:
                    pred = detect_stress(word)

            if pred != expected_primary:
                mismatches += 1

        # Also run 50,000 live O(log N) mmap binary searches to benchmark lookup latency
        sample_words = [w for w in list(word_stresses.keys())[:50000]]
        t_bench_start = time.perf_counter()
        for w in sample_words:
            target = fnv1a_64(w)
            lo = 0
            hi = count - 1
            while lo <= hi:
                mid = (lo + hi) >> 1
                h, sb = struct.unpack_from("<QB", mm, 12 + mid * 9)
                if h == target:
                    break
                elif h < target:
                    lo = mid + 1
                else:
                    hi = mid - 1
        t_bench_elapsed = time.perf_counter() - t_bench_start
        avg_ns = (t_bench_elapsed / max(1, len(sample_words))) * 1e9
        mm.close()

    t_val = time.perf_counter() - t0
    print(
        f"[Validation] Checked {checked:,} words against {bin_path.name}: "
        f"Mismatches = {mismatches} (Accuracy = {(checked - mismatches) / max(1, checked) * 100:.4f}%) | "
        f"Avg mmap O(log N) lookup = {avg_ns:.0f} ns ({avg_ns / 1000:.2f} µs) | Time = {t_val:.2f}s"
    )
    assert mismatches == 0, f"Expected 0 mismatches, got {mismatches}!"
    return checked, mismatches


def build_sqlite_rhyme_db(
    word_stresses: Dict[str, List[int]],
    tier1_words: Set[str],
    tier2_words: Set[str],
    db_path: Path,
    fast_json_path: Path
) -> Dict[str, int | float]:
    """
    Builds the SQLite reverse rhyme database (/data/rhymes.db) in WAL mode with
    idx_exact and idx_assonance composite indexes for < 1 ms top-30 queries.
    """
    t0 = time.perf_counter()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    if db_path.exists():
        db_path.unlink()

    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()
    cur.execute("PRAGMA journal_mode = WAL;")
    cur.execute("PRAGMA synchronous = OFF;")
    cur.execute("PRAGMA temp_store = MEMORY;")
    cur.execute("PRAGMA cache_size = -64000;")

    cur.execute("""
        CREATE TABLE words (
            word TEXT NOT NULL,
            stressed_word TEXT NOT NULL,
            rhyme_sig TEXT NOT NULL,
            stressed_vowel TEXT NOT NULL,
            clause_syllables INTEGER NOT NULL,
            syllable_count INTEGER NOT NULL,
            singability REAL NOT NULL,
            onset_class TEXT NOT NULL,
            is_verb INTEGER NOT NULL,
            freq_tier INTEGER NOT NULL
        );
    """)

    batch: List[Tuple[str, str, str, str, int, int, float, str, int, int]] = []
    fast_browser_buckets: Dict[str, List[Dict[str, str | int | float]]] = {}
    inserted = 0

    # We index all tier1 + tier2 words + representative poetic vocabulary up to 1..6 syllables
    # so SQLite has a rich 350,000+ word rhyme lexicon with < 0.3 ms indexed lookup
    for word, stresses in word_stresses.items():
        if len(word) < 2 or len(word) > 16:
            continue
        vowel_positions = [i for i, ch in enumerate(word) if ch in VOWELS]
        S = len(vowel_positions)
        if S < 1 or S > 7:
            continue

        if word in tier1_words:
            freq_tier = 1
        elif word in tier2_words and 3 <= len(word) <= 9:
            freq_tier = 2
        else:
            continue

        # Keep all tier 1 (~65k core words) and every 4th tier 2 poetic word (~135k words) -> ~200,000 prime words (~18 MB SQLite DB)
        if freq_tier == 2 and (fnv1a_64(word) % 4 != 0):
            continue

        s_idx = stresses[0]
        rhyme_sig, stressed_vowel, clause_syllables, S, singability, onset_class = (
            extract_word_rhyme_features(word, vowel_positions, s_idx)
        )
        if not rhyme_sig:
            continue

        stressed_word = make_stressed_word(word, vowel_positions, s_idx) if S > 1 else word
        is_verb = 1 if word.endswith(("ти", "тися", "ть", "ться", "ла", "ло", "ли", "ив", "ав", "яв")) else 0

        batch.append((
            word,
            stressed_word,
            rhyme_sig,
            stressed_vowel,
            clause_syllables,
            S,
            singability,
            onset_class,
            is_verb,
            freq_tier
        ))
        inserted += 1

        if freq_tier == 1 and len(rhyme_sig) >= 2:
            bucket = fast_browser_buckets.setdefault(rhyme_sig, [])
            if len(bucket) < 18:
                bucket.append({
                    "w": word,
                    "sw": stressed_word,
                    "s": S,
                    "o": singability,
                    "oc": onset_class[0],  # 'v', 'g', 's', 'o'
                    "v": is_verb
                })

        if len(batch) >= 25000:
            cur.executemany(
                "INSERT INTO words VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
                batch
            )
            batch.clear()

    if batch:
        cur.executemany(
            "INSERT INTO words VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);",
            batch
        )
        batch.clear()

    print(f"[RhymeDB] Inserted {inserted:,} rhyme records. Creating composite indexes...")
    cur.execute("CREATE INDEX idx_exact ON words(rhyme_sig, syllable_count, freq_tier);")
    cur.execute("CREATE INDEX idx_assonance ON words(stressed_vowel, clause_syllables, syllable_count, freq_tier);")
    cur.execute("ANALYZE;")
    conn.commit()

    # Benchmark query time (< 1 ms target)
    test_queries = [
        ("окий", "о", 2, 3),
        ("очі", "о", 2, 2),
        ("емлі", "е", 1, 2),
        ("оля", "о", 2, 2),
        ("іти", "і", 2, 2),
    ]
    q_times_ms: List[float] = []
    for sig, sv, cs, target_s in test_queries:
        qt0 = time.perf_counter()
        cur.execute(
            """
            SELECT word, stressed_word, rhyme_sig, syllable_count, singability, onset_class, is_verb, freq_tier
            FROM words
            WHERE rhyme_sig = ? AND syllable_count BETWEEN ? AND ?
            ORDER BY (syllable_count = ?) DESC, freq_tier ASC, singability DESC
            LIMIT 30;
            """,
            (sig, max(1, target_s - 1), target_s + 1, target_s)
        )
        _ = cur.fetchall()
        q_times_ms.append((time.perf_counter() - qt0) * 1000.0)

    conn.close()

    fast_json_path.write_text(
        json.dumps(fast_browser_buckets, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8"
    )

    t_total = time.perf_counter() - t0
    db_size_mb = db_path.stat().st_size / 1024 / 1024
    avg_q_ms = sum(q_times_ms) / len(q_times_ms)
    print(
        f"[RhymeDB] Built {db_path.name} ({db_size_mb:.2f} MB, {inserted:,} words) in {t_total:.2f}s | "
        f"Avg top-30 query time = {avg_q_ms:.3f} ms (target < 1.0 ms)"
    )
    return {
        "insertedWords": inserted,
        "dbSizeMB": round(db_size_mb, 2),
        "avgQueryTimeMs": round(avg_q_ms, 3),
    }


def main() -> None:
    print("=" * 80)
    print(" B-NoTe Core v2.5 — Offline Dictionary & SQLite Rhyme Index Compiler")
    print("=" * 80)

    word_stresses, tier1_words, tier2_words = load_corpus()

    # 1. Build Full 2.6M Corpus Binary Diff Index (/data/stress-diff-full.bin) and validate 100% accuracy
    full_bin_path = DATA_DIR / "stress-diff-full.bin"
    full_meta_path = DATA_DIR / "stress-diff-full-meta.json"
    build_binary_diff_index(word_stresses, full_bin_path, full_meta_path)
    validate_100_percent_accuracy(word_stresses, full_bin_path, full_meta_path)

    # 2. Build Browser Zero-Copy Binary Diff Index (/public/stress-diff.bin) for instant client fetch
    # Includes all tier1 + tier2 words that differ from detect_stress
    browser_subset = tier1_words | tier2_words
    browser_bin_path = PUBLIC_DIR / "stress-diff.bin"
    browser_meta_path = PUBLIC_DIR / "stress-diff-meta.json"
    build_binary_diff_index(word_stresses, browser_bin_path, browser_meta_path, subset_filter=browser_subset)
    validate_100_percent_accuracy(word_stresses, browser_bin_path, browser_meta_path, subset_filter=browser_subset)

    # 3. Build SQLite Reverse Rhyme Index (/data/rhymes.db) + Browser Fast Rhyme Fallback (/public/rhymes-fast.json)
    rhyme_db_path = DATA_DIR / "rhymes.db"
    fast_rhyme_json = PUBLIC_DIR / "rhymes-fast.json"
    build_sqlite_rhyme_db(word_stresses, tier1_words, tier2_words, rhyme_db_path, fast_rhyme_json)
    print("=" * 80)


if __name__ == "__main__":
    main()

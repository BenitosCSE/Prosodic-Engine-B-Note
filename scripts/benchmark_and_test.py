#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
B-NoTe Core v2.5 — Master Verification, Unit Tests & Benchmarks Suite
=====================================================================

Verifies:
1. Python Core v2.5 Bugfixes (CLITICS_SET, disyllabic verb detect_stress, smooth asymptotic r_max)
2. Zero-Copy mmap Binary Stress Diff startup & lookup latency vs legacy JSON parse
3. SQLite rhymes.db top-30 exact + assonance query latency (< 1.0 ms) + biomechanical ranking
4. TypeScript Core v2.5 Engine unit tests & 120-line Dirty-Line Cache benchmark
"""

from __future__ import annotations

import os
import sys
import json
import time
import sqlite3
import subprocess
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent
ARTIFACT_PY = ROOT_DIR / ".aistudio" / "artifacts" / "brain" / "1318779b-fbf4-4b3a-84ec-f7589781fd7e"
sys.path.insert(0, str(ARTIFACT_PY))
sys.path.insert(0, str(ROOT_DIR / "scripts"))

import prosody_engine as pe


def test_python_core_bugfixes() -> None:
    print("\n[1/4] Testing Python Core v2.5 Bugfixes...")

    # Bugfix #1: Content monosyllables vs clitics
    for w in ("зло", "дно", "гра", "сто", "три", "два", "свій"):
        res = pe.analyze_text(w)
        assert len(res.syllables) == 1 and res.syllables[0].stressed is True, f"Failed on content word: {w}"

    for c in ("і", "та", "як", "що", "не", "бо", "чи", "то", "за", "на", "по", "до", "зі"):
        res = pe.analyze_text(c)
        assert len(res.syllables) == 1 and res.syllables[0].stressed is False, f"Failed on clitic: {c}"
    print("  ✓ Bugfix #1 (CLITICS_SET vs зло/дно/гра/три): PASSED")

    # Bugfix #2: Disyllabic verbal endings
    for w, expected in (("мала", 0), ("грала", 0), ("ставив", 0), ("бачив", 0), ("читала", 1), ("говоримо", 3)):
        got = pe.detect_stress(w)
        assert got == expected, f"detect_stress({w!r}) expected {expected}, got {got}"
    print("  ✓ Bugfix #2 (detect_stress on мала/грала/ставив): PASSED")

    # Bugfix #3: Smooth asymptotic r_max
    r_norm = pe.analyze_text("Реве та стогне Дніпр широкий").r_max
    r_dense1 = pe.analyze_text("Встрікздро псткрахт мктріств").r_max
    r_dense2 = pe.analyze_text("Встрікздрфктшчо псткрахтщчша").r_max
    assert r_dense1 > 0.5 and r_dense2 > 0.5, f"r_max hit floor: {r_dense1}, {r_dense2}"
    assert r_norm > r_dense1 > r_dense2, f"r_max not monotonically decaying: {r_norm}, {r_dense1}, {r_dense2}"
    print(f"  ✓ Bugfix #3 (Smooth asymptotic r_max: {r_norm:.2f} -> {r_dense1:.2f} -> {r_dense2:.2f}): PASSED")


def benchmark_dictionary_startup_and_lookup() -> None:
    print("\n[2/4] Benchmarking Legacy JSON vs Zero-Copy mmap Binary Diff...")

    json_path = ROOT_DIR / "public" / "stress-db.json"
    bin_full_path = ROOT_DIR / "data" / "stress-diff-full.bin"
    bin_pub_path = ROOT_DIR / "public" / "stress-diff.bin"

    # Legacy JSON startup parse time
    t0 = time.perf_counter()
    legacy_data = json.loads(json_path.read_text(encoding="utf-8"))
    t_json_startup_ms = (time.perf_counter() - t0) * 1000.0

    # Zero-Copy mmap startup time
    t1 = time.perf_counter()
    idx_full = pe.BinaryStressDiffIndex(str(bin_full_path))
    t_mmap_startup_ms = (time.perf_counter() - t1) * 1000.0

    # Lookup benchmark
    test_words = ["широкий", "високий", "глибокий", "оновленій", "каламутній", "була", "взяла", "мала"]
    ITERS = 20000
    t2 = time.perf_counter()
    for i in range(ITERS):
        w = test_words[i & 7]
        hit = idx_full.lookup(w)
        _ = hit[0] if hit is not None else pe.detect_stress(w)
    t_lookup_us = ((time.perf_counter() - t2) / ITERS) * 1e6
    idx_full.close()

    print(f"  • Legacy JSON parse startup (stress-db.json, 4.8 MB): {t_json_startup_ms:.2f} ms")
    print(f"  • Zero-Copy mmap startup (stress-diff-full.bin, {bin_full_path.stat().st_size / 1024 / 1024:.2f} MB, 1.80M records): {t_mmap_startup_ms:.4f} ms ({t_json_startup_ms / max(0.0001, t_mmap_startup_ms):.0f}x faster)")
    print(f"  • Browser binary asset (public/stress-diff.bin): {bin_pub_path.stat().st_size / 1024 / 1024:.2f} MB (0 ms JSON parse)")
    print(f"  • Average Zero-Copy mmap + detect_stress lookup: {t_lookup_us:.2f} µs")


def benchmark_sqlite_rhyme_engine() -> None:
    print("\n[3/4] Benchmarking SQLite Reverse Rhyme Index (/data/rhymes.db)...")

    db_path = ROOT_DIR / "data" / "rhymes.db"
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    cur = conn.cursor()

    queries = [
        ("окий", "о", 2, 3, "широкий"),
        ("ива", "и", 2, 3, "завива"),
        ("емлі", "е", 2, 2, "землі"),
        ("очі", "о", 2, 2, "ночі"),
        ("оля", "о", 2, 2, "доля"),
        ("іти", "і", 2, 2, "жити"),
    ]

    times_ms = []
    sample_results = []
    for sig, sv, cs, target_s, anchor_w in queries:
        t0 = time.perf_counter()
        cur.execute(
            """
            SELECT word, stressed_word, rhyme_sig, syllable_count, singability, onset_class, is_verb, freq_tier
            FROM words
            WHERE rhyme_sig = ?
              AND syllable_count BETWEEN ? AND ?
              AND word != ?
            ORDER BY (syllable_count = ?) DESC, freq_tier ASC, singability DESC
            LIMIT 30;
            """,
            (sig, max(1, target_s - 1), target_s + 1, anchor_w, target_s)
        )
        rows = cur.fetchall()
        elapsed_ms = (time.perf_counter() - t0) * 1000.0
        times_ms.append(elapsed_ms)
        if sig == "окий":
            sample_results = rows[:5]

    conn.close()
    avg_ms = sum(times_ms) / len(times_ms)
    assert avg_ms < 1.0, f"Expected SQLite top-30 query < 1.0 ms, got {avg_ms:.3f} ms"
    print(f"  ✓ Average SQLite top-30 query time: {avg_ms:.3f} ms (max={max(times_ms):.3f} ms, target < 1.0 ms)")
    print(f"  ✓ Top candidates for 'широкий' (-окий, ΔS=3): {[r[1] for r in sample_results]}")


def run_ts_suite() -> None:
    print("\n[4/4] Running TypeScript Engine Tests & 120-Line Dirty-Line Cache Benchmark...")
    res = subprocess.run(
        ["npx", "tsx", "scripts/test_ts_engine.ts"],
        cwd=str(ROOT_DIR),
        capture_output=True,
        text=True,
        check=True
    )
    print(res.stdout.strip())


if __name__ == "__main__":
    print("=" * 80)
    print(" B-NoTe Core v2.5 — Full Test & Benchmark Suite")
    print("=" * 80)
    test_python_core_bugfixes()
    benchmark_dictionary_startup_and_lookup()
    benchmark_sqlite_rhyme_engine()
    run_ts_suite()
    print("=" * 80)
    print(" ALL TESTS AND BENCHMARKS PASSED 100%")
    print("=" * 80)

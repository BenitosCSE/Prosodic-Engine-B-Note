import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  analyzeText,
  analyzeTextCached,
  clearProsodyLineCache,
  detectStress,
  evaluateJunctionBiomechanics,
  fnv1a64,
} from '../src/utils/prosodyEngine';
import { resolveStanzaAnchorLine } from '../src/utils/rhymeEngine';
import { Row } from '../src/components/song/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function assert(cond: boolean, msg: string) {
  if (!cond) {
    throw new Error(`ASSERTION FAILED: ${msg}`);
  }
}

async function runTests() {
  console.log('--- [TS Engine] Running Core v2.5 Unit Tests & Benchmarks ---');

  // 1. Bugfix #1: Content monosyllables vs functional clitics
  const contentMonosyllables = ['зло', 'дно', 'гра', 'сто', 'три', 'два', 'свій'];
  for (const w of contentMonosyllables) {
    const m = analyzeText(w, 120, 4, {});
    assert(m.syllables.length === 1, `Expected 1 syllable for ${w}`);
    assert(m.syllables[0].stressed === true, `Bugfix #1 failed: '${w}' must be stressed!`);
  }

  const functionalClitics = ['і', 'та', 'як', 'що', 'не', 'бо', 'чи', 'то', 'за', 'на', 'по', 'до', 'зі'];
  for (const c of functionalClitics) {
    const m = analyzeText(c, 120, 4, {});
    assert(m.syllables.length === 1, `Expected 1 syllable for clitic ${c}`);
    assert(m.syllables[0].stressed === false, `Bugfix #1 failed: clitic '${c}' must be unstressed!`);
  }
  console.log('✓ Bugfix #1 (Explicit CLITICS_SET vs content monosyllables зло/дно/гра/три): PASSED');

  // 2. Bugfix #2: Disyllabic verbal forms in detectStress
  assert(detectStress('мала') === 0, `Expected detectStress('мала') === 0, got ${detectStress('мала')}`);
  assert(detectStress('грала') === 0, `Expected detectStress('грала') === 0, got ${detectStress('грала')}`);
  assert(detectStress('ставив') === 0, `Expected detectStress('ставив') === 0, got ${detectStress('ставив')}`);
  assert(detectStress('бачив') === 0, `Expected detectStress('бачив') === 0, got ${detectStress('бачив')}`);
  assert(detectStress('читала') === 1, `Expected detectStress('читала') === 1, got ${detectStress('читала')}`);
  assert(detectStress('говоримо') === 3, `Expected detectStress('говоримо') === 3, got ${detectStress('говоримо')}`);
  console.log('✓ Bugfix #2 (Disyllabic verbal endings мала/грала/ставив -> 0): PASSED');

  // 3. Bugfix #3: Smooth asymptotic rMax without 0.5 plateau on extreme clusters
  const normalLine = analyzeText('Реве та стогне Дніпр широкий', 100, 4, {});
  const heavyCluster1 = analyzeText('Встрікздро псткрахт мктріств', 120, 4, {});
  const heavyCluster2 = analyzeText('Встрікздрфктшчо псткрахтщчша', 120, 4, {});
  assert(heavyCluster1.rMax > 0.5, `Expected smooth rMax > 0.5, got ${heavyCluster1.rMax}`);
  assert(heavyCluster2.rMax > 0.5, `Expected smooth rMax > 0.5, got ${heavyCluster2.rMax}`);
  assert(
    normalLine.rMax > heavyCluster1.rMax && heavyCluster1.rMax > heavyCluster2.rMax,
    `Expected strictly decreasing smooth asymptotic curve: ${normalLine.rMax} > ${heavyCluster1.rMax} > ${heavyCluster2.rMax}`
  );
  console.log(
    `✓ Bugfix #3 (Smooth asymptotic rMax curve: normal=${normalLine.rMax.toFixed(2)}, heavy1=${heavyCluster1.rMax.toFixed(2)}, heavy2=${heavyCluster2.rMax.toFixed(2)}): PASSED`
  );

  // 4. Task 2: Stanza Rhyme Scheme ABAB anchor resolution + Biomechanical Junction Ranking
  const testRows: Row[] = [
    { id: 'sec1', text: '[VERSE]', isSection: true },
    { id: 'r1', text: 'Реве та стогне Дніпр широкий', isSection: false },
    { id: 'r2', text: 'Сердитий вітер завива', isSection: false },
    { id: 'r3', text: 'Додолу верби гне', isSection: false },
    { id: 'r4', text: 'Горами хвилю', isSection: false },
  ];

  const anchorForLine3 = resolveStanzaAnchorLine(testRows, 'r3', 'ABAB', 100, 4, {}, 4, false);
  assert(anchorForLine3 !== null, 'Expected anchor for line 3 in ABAB');
  assert(anchorForLine3!.anchorRowId === 'r1', `Expected line 3 to anchor to r1, got ${anchorForLine3!.anchorRowId}`);
  assert(anchorForLine3!.rhymeSignature === 'окий', `Expected sig 'окий', got ${anchorForLine3!.rhymeSignature}`);
  assert(anchorForLine3!.targetSyllables === 9, `Expected target S=9, got ${anchorForLine3!.targetSyllables}`);

  const anchorForLine4 = resolveStanzaAnchorLine(testRows, 'r4', 'ABAB', 100, 4, {}, 4, false);
  assert(anchorForLine4 !== null, 'Expected anchor for line 4 in ABAB');
  assert(anchorForLine4!.anchorRowId === 'r2', `Expected line 4 to anchor to r2, got ${anchorForLine4!.anchorRowId}`);

  // Biomechanical junction check: after closed obstruent coda ("ліс весь"), vowel onset ("окий") gives sandhi, obstruent onset ("глибокий") gives obstruent_clash
  const prefixMetrics = analyzeText('Темний ліс весь', 120, 4, {});
  const jSandhi = evaluateJunctionBiomechanics('Темний ліс весь', 'vowel', 3, 75, prefixMetrics, 120, 4);
  const jClash = evaluateJunctionBiomechanics('Темний ліс весь', 'obstruent', 3, 75, prefixMetrics, 120, 4);
  assert(jSandhi.junctionType === 'sandhi', `Expected sandhi, got ${jSandhi.junctionType}`);
  assert(jClash.junctionType === 'obstruent_clash', `Expected obstruent_clash, got ${jClash.junctionType}`);
  assert(
    jSandhi.biomechanicalScore > jClash.biomechanicalScore,
    `Expected sandhi score (${jSandhi.biomechanicalScore}) > clash score (${jClash.biomechanicalScore})`
  );
  console.log('✓ Task 2 (ABAB Stanza Anchor 3↔1, 4↔2 & Biomechanical Sandhi vs Obstruent Clash): PASSED');

  // 5. Task 1: Zero-Copy Binary Stress Diff DataView lookup + 120-line Dirty-Line Cache Benchmark
  const binPath = path.join(__dirname, '..', 'public', 'stress-diff.bin');
  const buf = fs.readFileSync(binPath);
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const recCount = view.getUint32(8, true);

  const sampleWords = ['широкий', 'високий', 'глибокий', 'оновленій', 'каламутній', 'україна', 'перемога', 'свобода'];
  const tBin0 = performance.now();
  const ITERS = 50000;
  let hits = 0;
  for (let iter = 0; iter < ITERS; iter++) {
    const w = sampleWords[iter & 7];
    const target = fnv1a64(w);
    let lo = 0;
    let hi = recCount - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >>> 1;
      const offset = 12 + mid * 9;
      const h = view.getBigUint64(offset, true);
      if (h === target) {
        hits++;
        break;
      } else if (h < target) {
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
  }
  const tBinElapsedMs = performance.now() - tBin0;
  const avgBinLookupUs = (tBinElapsedMs * 1000) / ITERS;

  // 120-Line Song Re-Analysis Benchmark (Uncached Full Pass vs Dirty-Line Cached 1-char edit)
  const song120Lines: string[] = [];
  const baseStanza = [
    'Реве та стогне Дніпр широкий',
    'Сердитий вітер завива',
    'Додолу верби гне високі',
    'Горами хвилю підійма',
    'І блідий місяць на ту пору',
    'Із хмари де-де виглядав',
  ];
  for (let i = 0; i < 120; i++) {
    song120Lines.push(`${baseStanza[i % baseStanza.length]} (${i})`);
  }

  // Benchmark A: Full uncached re-analysis of 120 lines on keystroke (BEFORE)
  const tBefore0 = performance.now();
  const RUNS = 50;
  for (let r = 0; r < RUNS; r++) {
    song120Lines[60] = `Додолу верби гне високі ${r}`;
    for (let i = 0; i < song120Lines.length; i++) {
      analyzeText(song120Lines[i], 120, 4, {});
    }
  }
  const avgBeforeMs = (performance.now() - tBefore0) / RUNS;

  // Benchmark B: Incremental Dirty-Line Cached re-analysis of 120 lines on keystroke (AFTER)
  clearProsodyLineCache();
  // Prime cache
  for (let i = 0; i < song120Lines.length; i++) {
    analyzeTextCached(song120Lines[i], 120, 4, {});
  }
  const tAfter0 = performance.now();
  for (let r = 0; r < RUNS; r++) {
    song120Lines[60] = `Додолу верби гне високі ${r}а`;
    for (let i = 0; i < song120Lines.length; i++) {
      analyzeTextCached(song120Lines[i], 120, 4, {});
    }
  }
  const avgAfterMs = (performance.now() - tAfter0) / RUNS;
  const speedup = avgBeforeMs / Math.max(0.001, avgAfterMs);

  console.log(
    `✓ Task 1 Benchmark (Zero-Copy DataView O(log N) over ${recCount.toLocaleString()} records): ${avgBinLookupUs.toFixed(2)} µs/lookup`
  );
  console.log(
    `✓ Task 1 Benchmark (120-line Song Keystroke Re-analysis): BEFORE = ${avgBeforeMs.toFixed(3)} ms | AFTER (Dirty-Line Cache) = ${avgAfterMs.toFixed(3)} ms (${speedup.toFixed(1)}x faster)`
  );
}

runTests().catch(err => {
  console.error(err);
  process.exit(1);
});

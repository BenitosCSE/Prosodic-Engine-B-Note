import express from 'express';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Built-in Node 22 SQLite (node:sqlite DatabaseSync)
let rhymeDb: any = null;
let stmtExact: any = null;
let stmtAssonance: any = null;

function initRhymeDatabase() {
  if (rhymeDb) return rhymeDb;
  try {
    const dbPath = path.join(__dirname, 'data', 'rhymes.db');
    if (!fs.existsSync(dbPath)) {
      console.warn('[RhymeDB] /data/rhymes.db not found yet.');
      return null;
    }
    const { DatabaseSync } = require('node:sqlite');
    rhymeDb = new DatabaseSync(dbPath, { readOnly: true });
    stmtExact = rhymeDb.prepare(`
      SELECT word, stressed_word, rhyme_sig, stressed_vowel, clause_syllables,
             syllable_count, singability, onset_class, is_verb, freq_tier
      FROM words
      WHERE rhyme_sig = ?
        AND syllable_count BETWEEN ? AND ?
        AND word != ?
      ORDER BY (syllable_count = ?) DESC, freq_tier ASC, singability DESC
      LIMIT 35
    `);
    stmtAssonance = rhymeDb.prepare(`
      SELECT word, stressed_word, rhyme_sig, stressed_vowel, clause_syllables,
             syllable_count, singability, onset_class, is_verb, freq_tier
      FROM words
      WHERE stressed_vowel = ?
        AND clause_syllables = ?
        AND syllable_count BETWEEN ? AND ?
        AND rhyme_sig != ?
        AND word != ?
      ORDER BY (syllable_count = ?) DESC, freq_tier ASC, singability DESC
      LIMIT 25
    `);
    console.log('[RhymeDB] Loaded /data/rhymes.db via node:sqlite (WAL read-only)');
    return rhymeDb;
  } catch (err) {
    console.warn('[RhymeDB] Failed to open /data/rhymes.db:', err);
    return null;
  }
}

const VOWELS_SET = new Set(['а', 'е', 'є', 'и', 'і', 'ї', 'о', 'у', 'ю', 'я']);
const DEIOT: Record<string, string> = { я: 'а', ю: 'у', є: 'е', ї: 'і' };

function normalizeRhymeSig(sig: string): {
  normSig: string;
  stressedVowel: string;
  clauseSyllables: number;
} {
  const clean = sig
    .toLowerCase()
    .replace(/[\u0301'’ʼ‘`ь]/g, '')
    .trim();
  const vowels: string[] = [];
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (VOWELS_SET.has(ch)) {
      vowels.push(DEIOT[ch] || ch);
    }
  }
  const firstCh = clean[0] || 'а';
  const stressedVowel = DEIOT[firstCh] || vowels[0] || 'а';
  const normSig = stressedVowel + clean.slice(1);
  return {
    normSig,
    stressedVowel,
    clauseSyllables: Math.max(1, vowels.length),
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  initRhymeDatabase();

  // Sub-millisecond SQLite Rhyme Lookup Endpoint
  app.get('/api/rhymes', (req, res) => {
    const t0 = performance.now();
    const rawSig = String(req.query.sig || '').trim();
    const deltaS = Math.max(1, Math.min(7, Number(req.query.deltaS) || 2));
    const anchorWord = String(req.query.anchorWord || '')
      .toLowerCase()
      .replace(/[\u0301'’ʼ‘`]/g, '')
      .trim();
    const excludeVerbs = req.query.excludeVerbs === '1';

    if (!rawSig) {
      res.json({ candidates: [], queryTimeMs: 0 });
      return;
    }

    const db = initRhymeDatabase();
    if (!db || !stmtExact || !stmtAssonance) {
      res.json({ candidates: [], queryTimeMs: 0, fallback: true });
      return;
    }

    const { normSig, stressedVowel, clauseSyllables } = normalizeRhymeSig(rawSig);
    const minS = Math.max(1, deltaS - 1);
    const maxS = Math.min(7, deltaS + 1);

    try {
      const exactRows = stmtExact.all(normSig, minS, maxS, anchorWord, deltaS) as any[];
      let assonanceRows: any[] = [];
      if (exactRows.length < 24) {
        assonanceRows = stmtAssonance.all(
          stressedVowel,
          clauseSyllables,
          minS,
          maxS,
          normSig,
          anchorWord,
          deltaS
        ) as any[];
      }

      const seen = new Set<string>();
      const candidates: any[] = [];

      const pushRow = (r: any, matchType: 'exact' | 'assonance') => {
        if (!r || !r.word || r.word === anchorWord) return;
        if (excludeVerbs && r.is_verb === 1) return;
        if (seen.has(r.word)) return;
        seen.add(r.word);
        candidates.push({
          word: r.word,
          stressedWord: r.stressed_word,
          rhymeSig: r.rhyme_sig,
          syllableCount: r.syllable_count,
          singability: r.singability,
          onsetClass: r.onset_class,
          isVerb: Boolean(r.is_verb),
          freqTier: r.freq_tier,
          matchType,
        });
      };

      exactRows.forEach(r => pushRow(r, 'exact'));
      assonanceRows.forEach(r => pushRow(r, 'assonance'));

      const queryTimeMs = Math.round((performance.now() - t0) * 1000) / 1000;
      res.json({
        candidates: candidates.slice(0, 30),
        queryTimeMs,
        normSig,
      });
    } catch (err) {
      console.error('[/api/rhymes] Query error:', err);
      res.status(500).json({ candidates: [], error: 'SQLite query failed' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[B-NoTe Server] Listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();

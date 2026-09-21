#!/usr/bin/env node
// One-time re-tagging of stoic_passages.concern_tags against the app's
// current 14-category concern vocabulary (lib/concerns.ts's
// CONCERN_OPTIONS). The old 6-category vocabulary and the new 14 share no
// exact strings, so this isn't a rename — every passage needs a fresh
// multi-label classification pass.
//
// Usage:
//   node scripts/retag-passage-concerns.js --dry-run [--limit 20]
//     Classifies a sample, prints old vs new tags, writes nothing.
//   node scripts/retag-passage-concerns.js
//     Classifies and updates every row in stoic_passages.
//
// Reads SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and
// EXPO_PUBLIC_ANTHROPIC_API_KEY from .env — the service-role key because
// this bypasses the app entirely (an admin content operation), same
// pattern as scripts/upload-ambient-track.js.
//
// IMPORTANT: CONCERN_VALUES below must be kept identical to
// lib/concerns.ts's CONCERN_OPTIONS. This script runs standalone via plain
// Node, not through the TS build, so it can't import that file directly —
// if you change the app's vocabulary, update both.
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const CONCERN_VALUES = [
  'Self-Doubt', 'Anger', 'Grief & Loss', 'Fear & Anxiety',
  'Motivation & Discipline', 'Relationships', 'Purpose & Meaning',
  'Mortality', 'Resilience', 'Envy & Comparison',
  'Control & Acceptance', 'Pride & Ego', 'General', 'Work & Career Stress',
];
const CONCERN_SET = new Set(CONCERN_VALUES);

const BATCH_SIZE = 25;
const BATCH_DELAY_MS = 300;

function loadEnv() {
  const envPath = path.join(__dirname, '..', '.env');
  const env = {};
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (match) env[match[1]] = match[2];
  }
  return env;
}

const env = loadEnv();
const supabaseUrl = env.SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const anthropicKey = env.EXPO_PUBLIC_ANTHROPIC_API_KEY;
if (!supabaseUrl || !serviceKey || !anthropicKey) {
  console.error('Missing SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, or EXPO_PUBLIC_ANTHROPIC_API_KEY in .env');
  process.exit(1);
}
const supabase = createClient(supabaseUrl, serviceKey);

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const limitArg = args.indexOf('--limit');
const limit = limitArg !== -1 ? parseInt(args[limitArg + 1], 10) : (dryRun ? 20 : null);

const SYSTEM_PROMPT = `You are tagging passages from Stoic philosophy (Marcus Aurelius, Epictetus, Seneca) with the concerns they're most relevant to. For each numbered passage, choose every applicable concern from EXACTLY this list — copy each value verbatim, do not invent, reorder, or abbreviate:
${CONCERN_VALUES.join(', ')}

A passage usually applies to 1-3 concerns. Return ONLY valid JSON: {"tags":[{"n":1,"concerns":["Resilience","Mortality"]},{"n":2,"concerns":["General"]}, ...]} — one entry per passage number, every passage must have at least one concern.`;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function classifyBatch(batch) {
  const prompt = batch
    .map((p, i) => {
      const source = p.section ? `${p.work}, ${p.section}` : p.work;
      return `[${i + 1}] ${p.author} — ${source}\n"${p.passage}"`;
    })
    .join('\n\n');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5',
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`Claude API failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const content = data.content.find((b) => b.type === 'text')?.text;
  if (!content) throw new Error('Empty response from Claude');
  const clean = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(clean);

  // Map Claude's 1-based batch position back to this batch's passage ids,
  // rather than trusting it to echo UUIDs — one wrong digit in an echoed
  // UUID would silently misfile a passage's tags onto the wrong row.
  const results = new Map();
  for (const entry of parsed.tags) {
    const passage = batch[entry.n - 1];
    if (!passage) continue;
    const concerns = (entry.concerns || []).filter((c) => CONCERN_SET.has(c));
    results.set(passage.id, concerns);
  }
  return results;
}

const onlyUnretagged = args.includes('--only-unretagged');

// Supabase/PostgREST caps an unpaginated select at 1000 rows regardless of
// table size — the first live run silently only touched the first 1000 of
// 2,328 rows because of this. Page through with .range() so a full run
// actually covers every row.
async function fetchAllPassages() {
  const pageSize = 1000;
  let all = [];
  let from = 0;
  while (true) {
    let query = supabase
      .from('stoic_passages')
      .select('id, author, work, section, passage, concern_tags')
      .order('id')
      .range(from, from + pageSize - 1);
    const { data, error } = await query;
    if (error) throw error;
    all = all.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
    if (limit && all.length >= limit) break;
  }
  return limit ? all.slice(0, limit) : all;
}

async function main() {
  console.log(dryRun ? `DRY RUN — sampling ${limit ?? 'all'} passages, no writes` : 'LIVE RUN — will update stoic_passages');

  let passages = await fetchAllPassages();
  if (onlyUnretagged) {
    passages = passages.filter((p) => {
      const tags = p.concern_tags || [];
      const alreadyDone = tags.length > 0 && tags.every((t) => CONCERN_SET.has(t));
      return !alreadyDone;
    });
  }
  console.log(`Fetched ${passages.length} passages.`);

  let tagged = 0;
  let skipped = 0;
  const skippedIds = [];

  for (let i = 0; i < passages.length; i += BATCH_SIZE) {
    const batch = passages.slice(i, i + BATCH_SIZE);
    let results;
    try {
      results = await classifyBatch(batch);
    } catch (err) {
      console.error(`Batch ${i}-${i + batch.length} failed, retrying once:`, err.message);
      try {
        results = await classifyBatch(batch);
      } catch (err2) {
        console.error(`Batch ${i}-${i + batch.length} failed again, skipping:`, err2.message);
        batch.forEach((p) => skippedIds.push(p.id));
        skipped += batch.length;
        continue;
      }
    }

    for (const passage of batch) {
      const newTags = results.get(passage.id);
      if (!newTags || newTags.length === 0) {
        console.error(`No valid tags returned for passage ${passage.id} (${passage.author}, ${passage.work}) — skipping`);
        skippedIds.push(passage.id);
        skipped += 1;
        continue;
      }

      if (dryRun) {
        console.log(`\n[${passage.author} — ${passage.work}]`);
        console.log(`  "${passage.passage.slice(0, 100)}${passage.passage.length > 100 ? '...' : ''}"`);
        console.log(`  before: ${JSON.stringify(passage.concern_tags)}`);
        console.log(`  after:  ${JSON.stringify(newTags)}`);
      } else {
        const { error: updateError } = await supabase
          .from('stoic_passages')
          .update({ concern_tags: newTags })
          .eq('id', passage.id);
        if (updateError) {
          console.error(`Write failed for passage ${passage.id}:`, updateError.message);
          skippedIds.push(passage.id);
          skipped += 1;
          continue;
        }
      }
      tagged += 1;
    }

    console.log(`Progress: ${Math.min(i + BATCH_SIZE, passages.length)}/${passages.length}`);
    await sleep(BATCH_DELAY_MS);
  }

  console.log(`\nDone. Tagged: ${tagged}, skipped: ${skipped}.`);
  if (skippedIds.length) console.log('Skipped ids:', skippedIds.join(', '));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

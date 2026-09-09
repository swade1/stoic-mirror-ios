# Concern-boosted retrieval: design notes

How the "Prioritize + Contextualize" personalization technique is implemented, and how the two deferred techniques (adaptive sequencing, personalization through reflection) are meant to plug in later without a rebuild.

## How boosting works

`stoic_passages.concern_tags` (`text[]`, GIN-indexed) holds zero or one entries from the shared vocabulary in `lib/concerns.ts`. It was populated once via `scripts/backfill-concern-tags.mjs` (deleted after running), which embedded the six concern labels with Voyage and compared each passage's *existing* embedding against them by cosine similarity — no new per-passage API cost, since every passage was already embedded for the RAG flow.

The `match_stoic_passages` Postgres function takes a new `boost_concerns text[]` parameter (the user's `profiles.concerns`) and changes only its `ORDER BY`:

```sql
order by (concern_tags && boost_concerns) desc, embedding <=> query_embedding
```

The `WHERE` clause — similarity threshold, already-shown-passage exclusion — is untouched. Every passage above the semantic-relevance threshold is still eligible; matching-concern ones simply sort first among them. Nothing is ever filtered out on the basis of `concern_tags`.

Rotation over time comes for free from the existing `exclude_ids` mechanism (`entry_quotes.passage_id`, already tracked): once a user's boosted, tagged passages for their concern have mostly been shown, later requests naturally surface passages from the broader corpus, since those are the ones left above threshold and not yet excluded.

## How framing is applied without altering quote text

At save time (`app/loading.tsx`), each selected quote's source passage's `concern_tags` is checked against the user's `profiles.concerns`; if there's a match, that specific concern label is snapshotted into a new `matched_concern` column on `entry_quotes` (and copied to `saved_quotes` when a quote is bookmarked). `lib/framing.ts`'s `getFramingLine(matchedConcern)` maps that label to one fixed, honest lead-in sentence — rendered as a separate `Text` element above the quote card in `app/detail.tsx` and `app/(tabs)/history.tsx`. The `quote` and `interpretation` fields themselves are never read by this function and never mutated.

Snapshotting `matched_concern` at surface time (rather than joining `stoic_passages.concern_tags` live at render time) means the framing a user sees stays historically accurate even if tags are re-tuned later — it reflects what was true when that quote was actually surfaced for them.

## How the deferred techniques plug in

**Adaptive sequencing over a period** (comfort → acceptance → strength, etc.): `concern_tags` is already an array, not a single value, so a passage can carry stage-specific metadata without restructuring this migration — e.g. a small `passage_arc_stage(passage_id, concern, stage)` join table, joined in alongside the existing boost tier: `order by (concern_tags && boost_concerns) desc, stage_rank, embedding <=> query_embedding`. The boost mechanism this plan built is the first tier of that eventual ordering, not a competing system.

**Personalization through reflection** (concern shaping Claude's own response phrasing, not just which quotes surface): the six per-concern Voyage embeddings computed transiently in the backfill script are the same shape a future prompt-framing layer would want (e.g. to select or blend a concern-specific system-prompt variant). `lib/concerns.ts`'s `CONCERN_OPTIONS` is the single vocabulary both this feature and that one should key off of, so a third divergent concern list never gets introduced. `loading.tsx`'s existing `concernContext` (fed into Claude's prompt today) is the natural extension point — this plan leaves it untouched.

## Known follow-up, not part of this work

`stoic_passages` has RLS disabled (flagged by Supabase's advisor during investigation) — every other table in the project has it enabled. Real issue, unrelated to this feature; worth a dedicated pass rather than folding into this migration.

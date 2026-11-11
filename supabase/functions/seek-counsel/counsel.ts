// Pure logic for the seek-counsel Edge Function: prompt building, response
// parsing, quote-to-passage matching, and rate-limit decisions. Nothing here
// touches Deno, the network, or the database, so jest can import it directly
// (see __tests__/lib/counsel.test.ts).

// Must stay identical to CONCERN_OPTIONS in lib/concerns.ts — the jest test
// fails if they drift. Edge Functions can't import from the app's lib/.
export const CATEGORIES = [
  'Self-Doubt',
  'Anger',
  'Grief & Loss',
  'Fear & Anxiety',
  'Motivation & Discipline',
  'Relationships',
  'Purpose & Meaning',
  'Mortality',
  'Resilience',
  'Envy & Comparison',
  'Control & Acceptance',
  'Pride & Ego',
  'General',
  'Work & Career Stress',
] as const;

export const DAILY_LIMIT = 40;
export const BURST_LIMIT = 5;
export const BURST_WINDOW_SECONDS = 60;
export const MAX_CONCERN_LENGTH = 2000;

export const SYSTEM_PROMPT = `You are a Stoic philosophy scholar. Given a person's concern and verified passages from Marcus Aurelius, Epictetus, and Seneca, select 3-5 most relevant passages and add a personal 2-sentence interpretation for each. Return ONLY valid JSON using EXACTLY one of the category strings listed:
{"quotes":[{"quote":"exact text","author":"name","source":"work","interpretation":"your counsel"}],"category":"one of: ${CATEGORIES.join(', ')}"}
The category value MUST be copied exactly as written above — do not reorder, abbreviate, or modify the category string.`;

export interface Passage {
  id: string;
  author: string;
  work: string;
  section: string | null;
  passage: string;
  concern_tags: string[] | null;
}

export interface CounselQuote {
  quote: string;
  author: string;
  source: string;
  interpretation: string;
  passage_id: string | null;
  matched_concern: string | null;
}

export interface CounselResult {
  quotes: CounselQuote[];
  category: string;
}

export type LimitDecision = 'ok' | 'burst' | 'daily';

/** Returns the trimmed concern, or null if it's missing, blank, or too long. */
export function validateConcern(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const concern = value.trim();
  if (concern.length === 0 || concern.length > MAX_CONCERN_LENGTH) return null;
  return concern;
}

export function decideLimit(countLastMinute: number, countLastDay: number): LimitDecision {
  if (countLastMinute >= BURST_LIMIT) return 'burst';
  if (countLastDay >= DAILY_LIMIT) return 'daily';
  return 'ok';
}

export function embeddingInput(concern: string): string {
  return `Stoic philosophy advice needed: ${concern}`;
}

export function buildUserMessage(
  concern: string,
  passages: Passage[],
  userConcerns: string[],
): string {
  const passageContext = passages
    .map((p, i) => {
      const source = p.section ? `${p.work}, ${p.section}` : p.work;
      return `[${i + 1}] ${p.author} — ${source}\n"${p.passage}"`;
    })
    .join('\n\n');

  const concernContext = userConcerns.length
    ? `\n\nFor background, this person has told us their ongoing concerns include: ${userConcerns.join(', ')}. Let this inform your interpretation where relevant, but prioritize what they've actually written above.`
    : '';

  return `The person's concern:\n"${concern}"\n\nAvailable passages:\n\n${passageContext}${concernContext}`;
}

/** Parses Claude's JSON reply (tolerating ```json fences). Throws on malformed output. */
export function parseCounsel(
  content: string,
  passages: Passage[],
  userConcerns: string[],
): CounselResult {
  const clean = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const parsed = JSON.parse(clean);
  if (!parsed || !Array.isArray(parsed.quotes) || parsed.quotes.length === 0) {
    throw new Error('Malformed counsel response');
  }

  const quotes: CounselQuote[] = parsed.quotes.slice(0, 5).map((q: any) => {
    // Match the returned quote back to the candidate it came from so the app
    // can exclude it from future retrieval, and snapshot which standing
    // concern (if any) it was tagged for.
    const source = passages.find((p) => p.passage === q.quote);
    const matched =
      source?.concern_tags?.find((t) => userConcerns.includes(t)) ?? null;
    return {
      quote: String(q.quote ?? ''),
      author: String(q.author ?? ''),
      source: String(q.source ?? ''),
      interpretation: String(q.interpretation ?? ''),
      passage_id: source?.id ?? null,
      matched_concern: matched,
    };
  });

  const category = (CATEGORIES as readonly string[]).includes(parsed.category)
    ? parsed.category
    : 'General';

  return { quotes, category };
}

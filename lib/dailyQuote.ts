/**
 * Deterministic mapping from a calendar date to a 1-indexed *position*
 * among daily_quotes rows ordered by id — not a literal id value, since
 * the id column isn't guaranteed to be a dense 1..count range. Callers
 * must fetch the row at this position (order by id, then offset), not
 * look it up by id equality. This lets every user see the same quote on
 * the same day without any server-side scheduling. Shared by
 * app/(tabs)/index.tsx (displaying today's quote) and lib/notifications.ts
 * (the daily reminder's content), which previously duplicated this
 * formula — kept in one place so they can't silently drift apart.
 */
export function getDailyQuoteId(date: Date, totalCount: number): number {
  if (totalCount <= 0) {
    throw new Error('getDailyQuoteId: totalCount must be greater than 0');
  }
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  return (seed % totalCount) + 1;
}

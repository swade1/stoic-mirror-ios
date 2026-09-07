import { getDailyQuoteId } from './dailyQuote';

describe('getDailyQuoteId', () => {
  it('returns a 1-indexed id within [1, totalCount]', () => {
    const id = getDailyQuoteId(new Date(2026, 0, 15), 366);
    expect(id).toBeGreaterThanOrEqual(1);
    expect(id).toBeLessThanOrEqual(366);
  });

  it('is deterministic — the same date and count always produce the same id', () => {
    const date = new Date(2026, 5, 1);
    const first = getDailyQuoteId(date, 200);
    const second = getDailyQuoteId(new Date(date), 200);
    expect(first).toBe(second);
  });

  it('changes as the date changes', () => {
    const day1 = getDailyQuoteId(new Date(2026, 0, 1), 366);
    const day2 = getDailyQuoteId(new Date(2026, 0, 2), 366);
    // Not guaranteed to differ for every count, but for a count this
    // large relative to the day-to-day seed change, they should.
    expect(day1).not.toBe(day2);
  });

  it('throws for a non-positive totalCount rather than dividing by zero', () => {
    expect(() => getDailyQuoteId(new Date(), 0)).toThrow();
    expect(() => getDailyQuoteId(new Date(), -1)).toThrow();
  });
});

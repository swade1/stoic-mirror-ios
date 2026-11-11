jest.mock('@/lib/supabase', () => ({ supabase: { functions: { invoke: jest.fn() } } }));

import { counselErrorFromBody, NO_PASSAGES_MESSAGE } from '@/lib/counselClient';

describe('counselErrorFromBody', () => {
  it('maps no_passages to the Entire Stoa message the screen matches on', () => {
    expect(counselErrorFromBody({ error: 'no_passages' }).message).toBe(NO_PASSAGES_MESSAGE);
  });

  it('distinguishes burst and daily rate limits', () => {
    expect(counselErrorFromBody({ error: 'rate_limited', reason: 'burst' }).message).toMatch(/wait a minute/);
    expect(counselErrorFromBody({ error: 'rate_limited', reason: 'daily' }).message).toMatch(/tomorrow/);
  });

  it('gives a generic message for upstream and unknown errors', () => {
    expect(counselErrorFromBody({ error: 'upstream' }).message).toMatch(/Something went wrong/);
    expect(counselErrorFromBody(null).message).toMatch(/Something went wrong/);
  });
});

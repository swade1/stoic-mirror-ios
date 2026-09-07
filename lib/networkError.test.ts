import { isNetworkError } from './networkError';

describe('isNetworkError', () => {
  it('recognizes React Native fetch\'s offline error', () => {
    expect(isNetworkError(new TypeError('Network request failed'))).toBe(true);
  });

  it('recognizes the web fetch offline error', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isNetworkError(new Error('NETWORK REQUEST FAILED'))).toBe(true);
  });

  it('does not match a real API failure message', () => {
    expect(isNetworkError(new Error('Passage retrieval failed'))).toBe(false);
    expect(isNetworkError(new Error('Claude API failed'))).toBe(false);
    expect(isNetworkError(new Error('Embedding failed: 401 Unauthorized'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isNetworkError('Network request failed')).toBe(false);
    expect(isNetworkError(null)).toBe(false);
    expect(isNetworkError(undefined)).toBe(false);
  });
});

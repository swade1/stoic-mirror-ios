import { encryptConcern, decryptConcern } from './encryption';

// Key derivation depends on expo-crypto's digestStringAsync, which
// jest-expo stubs out rather than computing a real SHA-256 — so a
// "different user id derives a different key" case isn't meaningfully
// testable here without a real crypto mock, and is intentionally omitted.
describe('encryptConcern / decryptConcern', () => {
  const userId = 'user-123';

  it('round-trips a concern back to its original text', async () => {
    const original = "I'm worried people don't like me.";
    const encrypted = await encryptConcern(original, userId);
    const decrypted = await decryptConcern(encrypted, userId);
    expect(decrypted).toBe(original);
  });

  it('produces ciphertext that does not contain the plaintext', async () => {
    const original = 'A fairly distinctive concern about work stress';
    const encrypted = await encryptConcern(original, userId);
    expect(encrypted).not.toContain(original);
  });

  it('passes plaintext through unchanged instead of throwing (legacy data fallback)', async () => {
    // Real pre-existing rows in saved_quotes were plaintext before
    // encryption was applied there — decryptConcern must degrade
    // gracefully for these rather than corrupt or throw.
    const plainText = "I've been trying to get promoted at work.";
    const result = await decryptConcern(plainText, userId);
    expect(result).toBe(plainText);
  });
});

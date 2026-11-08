import { hasPaidAccess } from '@/lib/subscription';

describe('hasPaidAccess', () => {
  // Purchases aren't wired up yet, so paid features are deliberately open.
  // Update this test together with the real entitlement check.
  it('currently allows access', async () => {
    await expect(hasPaidAccess()).resolves.toBe(true);
  });
});

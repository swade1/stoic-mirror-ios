import { TRIAL_DAYS, cancelByFrom, formatTrialDate, trialEndFrom } from '@/lib/trial';

describe('trial dates', () => {
  it('ends the trial TRIAL_DAYS after it starts', () => {
    const start = new Date(2026, 10, 8, 21, 30);
    expect(trialEndFrom(start)).toEqual(new Date(2026, 10, 8 + TRIAL_DAYS, 21, 30));
  });

  it('shows a cancel-by date two days before the trial ends', () => {
    const end = new Date(2026, 10, 11, 21, 30);
    expect(formatTrialDate(cancelByFrom(end))).toBe('November 9');
  });

  it('always puts the cancel-by day before Apple\'s 24-hour cut-off', () => {
    const end = new Date(2026, 10, 11, 0, 5);
    const cutoff = end.getTime() - 24 * 60 * 60 * 1000;
    const cancelByEndOfDay = new Date(cancelByFrom(end));
    cancelByEndOfDay.setHours(23, 59, 59, 999);
    expect(cancelByEndOfDay.getTime()).toBeLessThan(cutoff);
  });
});

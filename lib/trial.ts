// The free trial's dates, in one place. Apple renews a subscription unless
// it is cancelled at least 24 hours before the trial ends, and cancelling
// early costs the user nothing — they keep full access until the trial ends.
// So the "cancel by" date shown to users is deliberately conservative: the
// end of the calendar day two days before the trial ends, which is always
// earlier than Apple's real cut-off, so nobody who follows it is charged.
export const TRIAL_DAYS = 3;

export function trialEndFrom(start: Date): Date {
  const end = new Date(start);
  end.setDate(end.getDate() + TRIAL_DAYS);
  return end;
}

export function cancelByFrom(trialEnd: Date): Date {
  const date = new Date(trialEnd);
  date.setDate(date.getDate() - 2);
  return date;
}

export function formatTrialDate(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

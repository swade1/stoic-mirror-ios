// Single source of truth for the app's concern vocabulary — used by the
// concern-selection screens (onboarding and Settings), the concern-boosted
// retrieval in loading.tsx, and the framing lead-ins in lib/framing.ts.
// Values are stored verbatim in profiles.concerns, stoic_passages.concern_tags,
// and entry_quotes/saved_quotes.matched_concern, so changing a label here
// changes what's matched everywhere at once.
export const CONCERN_OPTIONS = [
  'Anxiety & worry',
  'Relationships & conflict',
  'Work & career stress',
  'Loss & grief',
  'Finding direction',
  'General peace of mind',
] as const;

export type Concern = (typeof CONCERN_OPTIONS)[number];

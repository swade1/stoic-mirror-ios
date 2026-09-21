// Single source of truth for the app's concern vocabulary — used by the
// concern-selection screens (onboarding and Settings), the counsel-session
// classification prompt in loading.tsx, the concern-boosted retrieval
// matching against stoic_passages.concern_tags, and the framing lead-ins
// in lib/framing.ts. Values are stored verbatim in profiles.concerns,
// stoic_passages.concern_tags, entries.category, and
// entry_quotes/saved_quotes.matched_concern, so changing a label here
// changes what's matched everywhere at once — and any edit here requires
// a matching update to lib/framing.ts's FRAMING_LEAD_INS and
// app/onboarding3.tsx's PLAN_DESCRIPTIONS (see their file comments).
export const CONCERN_OPTIONS = [
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

export type Concern = (typeof CONCERN_OPTIONS)[number];

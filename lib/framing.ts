// Light-touch contextual framing for concern-boosted quotes. Returns a short,
// honest lead-in sentence tying a surfaced quote to the user's concern — it
// never rewrites or interprets the quote itself, which stays exactly as
// sourced from stoic_passages.
// Keys must match lib/concerns.ts's CONCERN_OPTIONS exactly — see that
// file's comment for the full list of places this vocabulary is shared.
const FRAMING_LEAD_INS: Record<string, string> = {
  'Self-Doubt': "For what you're working through, on self-doubt:",
  'Anger': "For what you're working through, on anger:",
  'Grief & Loss': "For what you're working through, on loss:",
  'Fear & Anxiety': "For what you're working through, on fear and anxiety:",
  'Motivation & Discipline': "For what you're working through, on motivation and discipline:",
  'Relationships': "For what you're working through, on relationships:",
  'Purpose & Meaning': "For what you're working through, on finding purpose:",
  'Mortality': "For what you're working through, on mortality:",
  'Resilience': "For what you're working through, on resilience:",
  'Envy & Comparison': "For what you're working through, on envy and comparison:",
  'Control & Acceptance': "For what you're working through, on control and acceptance:",
  'Pride & Ego': "For what you're working through, on pride and ego:",
  'General': "For what you're working through, on finding peace:",
  'Work & Career Stress': "For what you're working through, on work and pressure:",
};

export function getFramingLine(matchedConcern: string | null | undefined): string | null {
  if (!matchedConcern) return null;
  return FRAMING_LEAD_INS[matchedConcern] ?? null;
}

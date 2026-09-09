// Light-touch contextual framing for concern-boosted quotes. Returns a short,
// honest lead-in sentence tying a surfaced quote to the user's concern — it
// never rewrites or interprets the quote itself, which stays exactly as
// sourced from stoic_passages.
const FRAMING_LEAD_INS: Record<string, string> = {
  'Anxiety & worry': "For what you're working through, on fear and anxiety:",
  'Relationships & conflict': "For what you're working through, on relationships:",
  'Work & career stress': "For what you're working through, on work and pressure:",
  'Loss & grief': "For what you're working through, on loss:",
  'Finding direction': "For what you're working through, on finding direction:",
  'General peace of mind': "For what you're working through, on finding peace:",
};

export function getFramingLine(matchedConcern: string | null | undefined): string | null {
  if (!matchedConcern) return null;
  return FRAMING_LEAD_INS[matchedConcern] ?? null;
}

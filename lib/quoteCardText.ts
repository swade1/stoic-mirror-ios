// Manual line breaks (the user pressing Return mid-sentence while editing
// a text box on a quote card) are a presentation choice tied to that
// photo's specific composition, not part of the wording itself — when the
// photo changes, they should collapse back to a normal flowing paragraph
// along with position/alignment resetting. Paragraph-level breaks (two or
// more consecutive newlines, e.g. before an attribution line) are left
// alone, since those are structural rather than a mid-sentence wrap.
export function flattenManualLineBreaks(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
    .join('\n\n');
}

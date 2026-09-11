// Splits a quote into words for line-break editing. Used consistently by
// both the editor (to render tappable words) and the renderer (to rebuild
// lines from persisted break points) — persisted indices only mean the
// same thing if both sides split the same way.
export function splitIntoWords(quote: string): string[] {
  return quote.trim().split(/\s+/).filter((w) => w.length > 0);
}

// Groups words into lines given a set of word-indices to break after.
// breakAfterIndices are 0-indexed into `words` — e.g. [1, 3] on
// ['The', 'world', 'is', 'a', 'stage'] breaks after "world" and after
// "a", producing ['The world', 'is a', 'stage']. Out-of-range indices
// (negative, or >= words.length - 1) are ignored rather than producing
// an empty line, since the editor UI shouldn't be able to produce those
// in practice, but persisted data could in principle be stale after an
// edit to the underlying quote.
export function groupWordsIntoLines(words: string[], breakAfterIndices: number[]): string[] {
  if (words.length === 0) return [];

  const validBreaks = new Set(
    breakAfterIndices.filter((i) => i >= 0 && i < words.length - 1)
  );

  const lines: string[] = [];
  let currentLine: string[] = [];

  words.forEach((word, index) => {
    currentLine.push(word);
    if (validBreaks.has(index)) {
      lines.push(currentLine.join(' '));
      currentLine = [];
    }
  });

  if (currentLine.length > 0) {
    lines.push(currentLine.join(' '));
  }

  return lines;
}

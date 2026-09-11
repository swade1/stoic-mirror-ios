// Persisted text position is stored as a fraction (0-1) of the card's own
// width/height, not raw pixels — a pixel offset captured on one device's
// screen would land in the wrong spot on a different-sized device, while a
// fraction scales correctly on any screen. The fraction represents where
// the CENTER of the text block sits on the card.

export const DEFAULT_TEXT_POSITION = { x: 0.5, y: 0.8 } as const;

export function clampFraction(value: number): number {
  return Math.min(1, Math.max(0, value));
}

// Converts a drag gesture's absolute pixel position (relative to the
// card's top-left corner) into a clamped 0-1 fraction of that card's
// dimensions, ready to persist.
export function pixelsToFraction(pixels: number, dimension: number): number {
  if (dimension <= 0) return 0;
  return clampFraction(pixels / dimension);
}

// Inverse: a stored fraction back into a pixel position for the card's
// current (possibly different-device) dimensions, for rendering.
export function fractionToPixels(fraction: number, dimension: number): number {
  return clampFraction(fraction) * dimension;
}

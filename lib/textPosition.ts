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

// The band of the card text must stay inside, as fractions of card height.
// The editor draws dashed guides at these lines, and drag/placement keep a
// text block between them, so text is never cropped by the card's edge or
// by the screen furniture around a shared video.
export const TEXT_SAFE_ZONE = { top: 0.08, bottom: 0.86 } as const;

// Clamps a block's top edge (pixels) so the whole block sits inside the safe
// band. A block taller than the band is pinned to the top of the band.
export function clampTextTop(top: number, blockHeight: number, cardHeight: number): number {
  const min = TEXT_SAFE_ZONE.top * cardHeight;
  const max = Math.max(min, TEXT_SAFE_ZONE.bottom * cardHeight - blockHeight);
  return Math.min(max, Math.max(min, top));
}

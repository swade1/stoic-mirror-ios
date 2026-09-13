// Pan/zoom bounds for a personal photo background rendered with
// contentFit="cover" plus an additional user-driven zoom on top.
// 'worklet' so the exact same tested function can run both in plain JS
// (initial bounds after picking a photo) and inside a gesture's
// .onUpdate on the UI thread (live clamping while dragging/pinching).

// The scale contentFit="cover" effectively applies: whichever axis needs
// to grow more to fully cover the card, so the other axis ends up with
// slack (the part cover crops away, and pan can reveal).
export function computeCoverScale(
  cardWidth: number,
  cardHeight: number,
  imageWidth: number,
  imageHeight: number
): number {
  'worklet';
  if (imageWidth <= 0 || imageHeight <= 0) return 1;
  return Math.max(cardWidth / imageWidth, cardHeight / imageHeight);
}

export interface PhotoPanBounds {
  maxTranslateX: number;
  maxTranslateY: number;
}

// How far the photo can be dragged in each axis, in on-screen pixels,
// before its edge would reveal empty space — given how much bigger than
// the card it currently is at this zoom level. zoom 1 = exactly the
// cover-fit baseline (today's default rendering); zoom > 1 = zoomed in
// further, which is what creates slack on an axis that had none at zoom 1.
export function computePhotoPanBounds(
  cardWidth: number,
  cardHeight: number,
  imageWidth: number,
  imageHeight: number,
  zoom: number
): PhotoPanBounds {
  'worklet';
  if (cardWidth <= 0 || cardHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return { maxTranslateX: 0, maxTranslateY: 0 };
  }
  const coverScale = computeCoverScale(cardWidth, cardHeight, imageWidth, imageHeight);
  const displayedWidth = imageWidth * coverScale * zoom;
  const displayedHeight = imageHeight * coverScale * zoom;
  return {
    maxTranslateX: Math.max(0, (displayedWidth - cardWidth) / 2),
    maxTranslateY: Math.max(0, (displayedHeight - cardHeight) / 2),
  };
}

export function clamp(value: number, min: number, max: number): number {
  'worklet';
  return Math.min(max, Math.max(min, value));
}

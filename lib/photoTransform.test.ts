import { computeCoverScale, computePhotoPanBounds, clamp } from './photoTransform';

describe('computeCoverScale', () => {
  it('picks the width ratio when the image is relatively taller than the card', () => {
    // 100x200 card, 100x100 image — image must grow 2x in height to cover,
    // which also grows width past 100, so width becomes the slack axis.
    expect(computeCoverScale(100, 200, 100, 100)).toBe(2);
  });

  it('picks the height ratio when the image is relatively wider than the card', () => {
    // 200x100 card, 100x100 image — mirror of the above.
    expect(computeCoverScale(200, 100, 100, 100)).toBe(2);
  });

  it('returns 1 when the image already exactly matches the card', () => {
    expect(computeCoverScale(300, 600, 300, 600)).toBe(1);
  });

  it('does not divide by zero for a degenerate image size', () => {
    expect(computeCoverScale(300, 600, 0, 0)).toBe(1);
  });
});

describe('computePhotoPanBounds', () => {
  it('has zero pan room on both axes when the image exactly matches the card at zoom 1', () => {
    expect(computePhotoPanBounds(300, 600, 300, 600, 1)).toEqual({ maxTranslateX: 0, maxTranslateY: 0 });
  });

  it('has pan room only on the slack axis at zoom 1', () => {
    // 100x200 card, 100x100 image — coverScale 2, displayed 200x200,
    // height matches exactly (0 slack), width has (200-100)/2 = 50 slack.
    expect(computePhotoPanBounds(100, 200, 100, 100, 1)).toEqual({ maxTranslateX: 50, maxTranslateY: 0 });
  });

  it('grows proportionally with zoom, including on the previously zero-slack axis', () => {
    // Same setup as above, but zoomed in 2x: displayed 400x400 in a
    // 100x200 card — both axes now have slack.
    expect(computePhotoPanBounds(100, 200, 100, 100, 2)).toEqual({ maxTranslateX: 150, maxTranslateY: 100 });
  });

  it('never returns negative bounds for degenerate inputs', () => {
    expect(computePhotoPanBounds(0, 0, 100, 100, 1)).toEqual({ maxTranslateX: 0, maxTranslateY: 0 });
    expect(computePhotoPanBounds(100, 100, 0, 0, 1)).toEqual({ maxTranslateX: 0, maxTranslateY: 0 });
  });
});

describe('clamp', () => {
  it('returns the value unchanged when within range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });

  it('clamps to the minimum', () => {
    expect(clamp(-5, 0, 10)).toBe(0);
  });

  it('clamps to the maximum', () => {
    expect(clamp(15, 0, 10)).toBe(10);
  });
});

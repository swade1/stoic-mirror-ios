import { clampFraction, pixelsToFraction, fractionToPixels, DEFAULT_TEXT_POSITION } from './textPosition';

describe('clampFraction', () => {
  it('leaves in-range values untouched', () => {
    expect(clampFraction(0.5)).toBe(0.5);
    expect(clampFraction(0)).toBe(0);
    expect(clampFraction(1)).toBe(1);
  });

  it('clamps values below 0', () => {
    expect(clampFraction(-0.3)).toBe(0);
  });

  it('clamps values above 1', () => {
    expect(clampFraction(1.4)).toBe(1);
  });
});

describe('pixelsToFraction', () => {
  it('converts a mid-range pixel position correctly', () => {
    expect(pixelsToFraction(150, 300)).toBe(0.5);
  });

  it('clamps a position beyond the dimension to 1', () => {
    expect(pixelsToFraction(400, 300)).toBe(1);
  });

  it('clamps a negative position to 0', () => {
    expect(pixelsToFraction(-50, 300)).toBe(0);
  });

  it('returns 0 for a zero or negative dimension rather than dividing by zero', () => {
    expect(pixelsToFraction(50, 0)).toBe(0);
    expect(pixelsToFraction(50, -10)).toBe(0);
  });
});

describe('fractionToPixels', () => {
  it('is the inverse of pixelsToFraction for in-range values', () => {
    expect(fractionToPixels(0.5, 300)).toBe(150);
    expect(fractionToPixels(DEFAULT_TEXT_POSITION.y, 400)).toBe(320);
  });

  it('clamps an out-of-range fraction before scaling', () => {
    expect(fractionToPixels(1.5, 300)).toBe(300);
    expect(fractionToPixels(-0.5, 300)).toBe(0);
  });

  it('round-trips through pixelsToFraction for the same dimension', () => {
    const dimension = 320;
    const original = 210;
    const fraction = pixelsToFraction(original, dimension);
    expect(fractionToPixels(fraction, dimension)).toBeCloseTo(original);
  });
});

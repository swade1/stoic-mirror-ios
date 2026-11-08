import { clampTextTop, TEXT_SAFE_ZONE } from '@/lib/textPosition';

describe('clampTextTop', () => {
  const card = 1000;
  const min = TEXT_SAFE_ZONE.top * card;
  const bottom = TEXT_SAFE_ZONE.bottom * card;

  it('leaves a block already inside the band alone', () => {
    expect(clampTextTop(400, 100, card)).toBe(400);
  });

  it('pulls a block that sits above the band down to its top', () => {
    expect(clampTextTop(-50, 100, card)).toBe(min);
  });

  it('pulls a block that would run past the bottom line back up', () => {
    expect(clampTextTop(900, 100, card)).toBe(bottom - 100);
  });

  it('pins a block taller than the band to the top of the band', () => {
    expect(clampTextTop(300, 2000, card)).toBe(min);
  });
});

import { getFramingLine } from './framing';
import { CONCERN_OPTIONS } from './concerns';

describe('getFramingLine', () => {
  it('returns a non-empty lead-in for every concern in the shared vocabulary', () => {
    for (const concern of CONCERN_OPTIONS) {
      const line = getFramingLine(concern);
      expect(typeof line).toBe('string');
      expect(line!.length).toBeGreaterThan(0);
    }
  });

  it('never alters or repeats the concern label verbatim as the whole line', () => {
    for (const concern of CONCERN_OPTIONS) {
      expect(getFramingLine(concern)).not.toBe(concern);
    }
  });

  it('returns null for no match', () => {
    expect(getFramingLine(null)).toBeNull();
    expect(getFramingLine(undefined)).toBeNull();
  });

  it('returns null for an unrecognized concern string', () => {
    expect(getFramingLine('Not a real concern')).toBeNull();
  });
});

import { derivePersonalTrackExtension } from './personalAmbientTrack';

describe('derivePersonalTrackExtension', () => {
  it('extracts the extension including the dot', () => {
    expect(derivePersonalTrackExtension('My Song.mp3')).toBe('.mp3');
  });

  it('handles multiple dots by using only the last segment', () => {
    expect(derivePersonalTrackExtension('track.final.m4a')).toBe('.m4a');
  });

  it('returns an empty string when there is no extension', () => {
    expect(derivePersonalTrackExtension('recording')).toBe('');
  });

  it('is case-preserving', () => {
    expect(derivePersonalTrackExtension('Song.WAV')).toBe('.WAV');
  });
});

import { groupTracksByMood, type AmbientTrack } from '@/lib/ambientTracks';

jest.mock('@/lib/supabase', () => ({ supabase: {} }));

const track = (name: string, mood: string | null): AmbientTrack => ({ id: name, url: `u/${name}`, name, mood });

describe('groupTracksByMood', () => {
  it('groups by mood alphabetically, sorting tracks within each group', () => {
    const groups = groupTracksByMood([
      track('Zephyr', 'still'),
      track('Comet Sings', 'solemn'),
      track('Lotus Hush', 'still'),
      track('Sunny', 'bright'),
    ]);
    expect(groups.map((g) => g.label)).toEqual(['Bright', 'Solemn', 'Still']);
    expect(groups[2].tracks.map((t) => t.name)).toEqual(['Lotus Hush', 'Zephyr']);
  });

  it('puts tracks without a mood in a trailing Other group', () => {
    const groups = groupTracksByMood([track('Mystery', null), track('Hush', 'still')]);
    expect(groups.map((g) => g.label)).toEqual(['Still', 'Other']);
  });

  it('returns nothing for no tracks', () => {
    expect(groupTracksByMood([])).toEqual([]);
  });
});

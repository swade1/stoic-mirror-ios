import {
  listAmbientTracks,
  deriveTrackName,
  deriveTrackMood,
  deriveTrackLength,
  getTrackMoods,
  getTrackLengths,
  withCacheBust,
} from './ambientTracks';

const mockList = jest.fn();
const mockGetPublicUrl = jest.fn();

jest.mock('@/lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        list: (...args: unknown[]) => mockList(...args),
        getPublicUrl: (path: string) => mockGetPublicUrl(path),
      }),
    },
  },
}));

describe('deriveTrackName', () => {
  it('drops the mood prefix and title-cases what remains', () => {
    expect(deriveTrackName('Bright-Rain On Leaves Loop.mp3')).toBe('Rain On Leaves Loop');
  });

  it('title-cases a lowercase name after the mood prefix', () => {
    expect(deriveTrackName('still-ocean waves.mp3')).toBe('Ocean Waves');
  });

  it('replaces underscores in the name portion with spaces', () => {
    expect(deriveTrackName('bright-quiet_forest.mp3')).toBe('Quiet Forest');
  });

  it('uses the whole filename as the name when there is no mood prefix', () => {
    expect(deriveTrackName('rain.mp3')).toBe('Rain');
  });

  it('treats a leading hyphen as no mood prefix, not an empty one', () => {
    expect(deriveTrackName('-soft-piano-.mp3')).toBe('Soft Piano');
  });

  it('drops both the mood and length tags when both are present', () => {
    expect(deriveTrackName('Bright-Short-Rain On Leaves.mp3')).toBe('Rain On Leaves');
    expect(deriveTrackName('Solemn-Medium-Evening Birdsong.mp3')).toBe('Evening Birdsong');
    expect(deriveTrackName('Still-Long-Bright Medley.mp3')).toBe('Bright Medley');
  });

  it('treats an unrecognized second segment as part of the name, not a length tag', () => {
    expect(deriveTrackName('Bright-Rain-On-Leaves.mp3')).toBe('Rain On Leaves');
  });
});

describe('deriveTrackMood', () => {
  it('reads the text before the first hyphen, lowercased', () => {
    expect(deriveTrackMood('Bright-Rain On Leaves Loop.mp3')).toBe('bright');
  });

  it('lowercases regardless of the source casing', () => {
    expect(deriveTrackMood('SOLEMN-Evening Birdsong.mp3')).toBe('solemn');
  });

  it('returns null when there is no hyphen', () => {
    expect(deriveTrackMood('rain.mp3')).toBeNull();
  });

  it('returns null for a leading hyphen rather than an empty-string mood', () => {
    expect(deriveTrackMood('-soft-piano-.mp3')).toBeNull();
  });

  it('still reads the mood correctly when a length tag is also present', () => {
    expect(deriveTrackMood('Bright-Short-Rain On Leaves.mp3')).toBe('bright');
  });
});

describe('deriveTrackLength', () => {
  it('reads the recognized second segment, lowercased', () => {
    expect(deriveTrackLength('Bright-Short-Rain On Leaves.mp3')).toBe('short');
    expect(deriveTrackLength('Bright-Medium-Rain On Leaves.mp3')).toBe('medium');
    expect(deriveTrackLength('Bright-Long-Rain On Leaves.mp3')).toBe('long');
  });

  it('is case-insensitive', () => {
    expect(deriveTrackLength('Bright-SHORT-Rain On Leaves.mp3')).toBe('short');
  });

  it('returns null for a mood-only filename (no length tag)', () => {
    expect(deriveTrackLength('Bright-Rain On Leaves Loop.mp3')).toBeNull();
  });

  it('returns null when there is no hyphen at all', () => {
    expect(deriveTrackLength('rain.mp3')).toBeNull();
  });

  it('does not mistake an unrecognized second segment for a length tag', () => {
    expect(deriveTrackLength('Bright-Rain-On-Leaves.mp3')).toBeNull();
  });
});

describe('getTrackMoods', () => {
  it('returns the distinct moods present, sorted alphabetically', () => {
    const tracks = [
      { id: '1', url: '', name: 'Ocean Waves', mood: 'still', length: null },
      { id: '2', url: '', name: 'Breathing Waves', mood: 'bright', length: null },
      { id: '3', url: '', name: 'Beach Memories', mood: 'solemn', length: null },
      { id: '4', url: '', name: 'Gentle Waves', mood: 'still', length: null },
    ];

    expect(getTrackMoods(tracks)).toEqual(['bright', 'solemn', 'still']);
  });

  it('ignores tracks with no mood', () => {
    const tracks = [
      { id: '1', url: '', name: 'Rain', mood: null, length: null },
      { id: '2', url: '', name: 'Breathing Waves', mood: 'bright', length: null },
    ];

    expect(getTrackMoods(tracks)).toEqual(['bright']);
  });

  it('returns an empty array when no track has a mood', () => {
    expect(getTrackMoods([{ id: '1', url: '', name: 'Rain', mood: null, length: null }])).toEqual([]);
  });
});

describe('getTrackLengths', () => {
  it('returns the distinct lengths present, in short/medium/long order regardless of input order', () => {
    const tracks = [
      { id: '1', url: '', name: 'A', mood: null, length: 'long' as const },
      { id: '2', url: '', name: 'B', mood: null, length: 'short' as const },
      { id: '3', url: '', name: 'C', mood: null, length: 'medium' as const },
      { id: '4', url: '', name: 'D', mood: null, length: 'short' as const },
    ];

    expect(getTrackLengths(tracks)).toEqual(['short', 'medium', 'long']);
  });

  it('ignores tracks with no length tag', () => {
    const tracks = [
      { id: '1', url: '', name: 'A', mood: null, length: null },
      { id: '2', url: '', name: 'B', mood: null, length: 'medium' as const },
    ];

    expect(getTrackLengths(tracks)).toEqual(['medium']);
  });

  it('returns an empty array when no track has a length tag', () => {
    expect(getTrackLengths([{ id: '1', url: '', name: 'A', mood: null, length: null }])).toEqual([]);
  });
});

describe('listAmbientTracks', () => {
  beforeEach(() => {
    mockList.mockReset();
    mockGetPublicUrl.mockReset();
    mockGetPublicUrl.mockImplementation((path: string) => ({
      data: { publicUrl: `https://cdn.example.com/${path}` },
    }));
  });

  it('lists bucket contents as sorted {id, url, name, mood, length} entries, with the URL cache-busted by updated_at', async () => {
    mockList.mockResolvedValue({
      data: [
        { id: '2', name: 'Bright-Short-Rain On Leaves Loop.mp3', updated_at: '2026-01-02T00:00:00.000Z' },
        { id: '1', name: 'Solemn-Evening Birdsong Loop.mp3', updated_at: '2026-01-01T00:00:00.000Z' },
      ],
      error: null,
    });

    const result = await listAmbientTracks();

    expect(result).toEqual([
      {
        id: 'Solemn-Evening Birdsong Loop.mp3',
        url: 'https://cdn.example.com/Solemn-Evening Birdsong Loop.mp3?v=2026-01-01T00%3A00%3A00.000Z',
        name: 'Evening Birdsong Loop',
        mood: 'solemn',
        length: null,
      },
      {
        id: 'Bright-Short-Rain On Leaves Loop.mp3',
        url: 'https://cdn.example.com/Bright-Short-Rain On Leaves Loop.mp3?v=2026-01-02T00%3A00%3A00.000Z',
        name: 'Rain On Leaves Loop',
        mood: 'bright',
        length: 'short',
      },
    ]);
  });

  it('gives an entry with no hyphen a null mood and null length', async () => {
    mockList.mockResolvedValue({
      data: [{ id: '1', name: 'rain.mp3', updated_at: '2026-01-01T00:00:00.000Z' }],
      error: null,
    });

    const result = await listAmbientTracks();

    expect(result).toEqual([
      {
        id: 'rain.mp3',
        url: 'https://cdn.example.com/rain.mp3?v=2026-01-01T00%3A00%3A00.000Z',
        name: 'Rain',
        mood: null,
        length: null,
      },
    ]);
  });

  it('excludes placeholder folder entries (id: null)', async () => {
    mockList.mockResolvedValue({
      data: [
        { id: null, name: '.emptyFolderPlaceholder' },
        { id: '1', name: 'Still-Long-Rain.mp3', updated_at: '2026-01-01T00:00:00.000Z' },
      ],
      error: null,
    });

    const result = await listAmbientTracks();

    expect(result).toEqual([
      {
        id: 'Still-Long-Rain.mp3',
        url: 'https://cdn.example.com/Still-Long-Rain.mp3?v=2026-01-01T00%3A00%3A00.000Z',
        name: 'Rain',
        mood: 'still',
        length: 'long',
      },
    ]);
  });

  it('throws when the Storage API returns an error', async () => {
    mockList.mockResolvedValue({ data: null, error: new Error('network down') });

    await expect(listAmbientTracks()).rejects.toThrow('network down');
  });

  it('pages through the bucket when a single call returns a full page', async () => {
    const firstPage = Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      name: `Bright-track-${String(i).padStart(3, '0')}.mp3`,
    }));
    const secondPage = [{ id: '100', name: 'Bright-final-track.mp3' }];
    mockList
      .mockResolvedValueOnce({ data: firstPage, error: null })
      .mockResolvedValueOnce({ data: secondPage, error: null });

    const result = await listAmbientTracks();

    expect(mockList).toHaveBeenCalledTimes(2);
    expect(mockList).toHaveBeenNthCalledWith(1, '', { limit: 100, offset: 0 });
    expect(mockList).toHaveBeenNthCalledWith(2, '', { limit: 100, offset: 100 });
    expect(result).toHaveLength(101);
  });
});

describe('withCacheBust', () => {
  it('appends the timestamp as a URL-encoded query param', () => {
    expect(withCacheBust('https://cdn.example.com/rain.mp3', '2026-01-01T00:00:00.000Z')).toBe(
      'https://cdn.example.com/rain.mp3?v=2026-01-01T00%3A00%3A00.000Z'
    );
  });

  it('returns the URL unchanged when there is no timestamp', () => {
    expect(withCacheBust('https://cdn.example.com/rain.mp3', null)).toBe('https://cdn.example.com/rain.mp3');
    expect(withCacheBust('https://cdn.example.com/rain.mp3', undefined)).toBe('https://cdn.example.com/rain.mp3');
  });

  it('gives two different timestamps two different URLs', () => {
    const first = withCacheBust('https://cdn.example.com/rain.mp3', '2026-01-01T00:00:00.000Z');
    const second = withCacheBust('https://cdn.example.com/rain.mp3', '2026-01-02T00:00:00.000Z');
    expect(first).not.toBe(second);
  });
});

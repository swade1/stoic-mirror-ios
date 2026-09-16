import { listAmbientTracks, deriveTrackName, deriveTrackMood, withCacheBust } from './ambientTracks';

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
});

describe('listAmbientTracks', () => {
  beforeEach(() => {
    mockList.mockReset();
    mockGetPublicUrl.mockReset();
    mockGetPublicUrl.mockImplementation((path: string) => ({
      data: { publicUrl: `https://cdn.example.com/${path}` },
    }));
  });

  it('lists bucket contents as sorted {id, url, name, mood} entries, with the URL cache-busted by updated_at', async () => {
    mockList.mockResolvedValue({
      data: [
        { id: '2', name: 'Bright-Rain On Leaves Loop.mp3', updated_at: '2026-01-02T00:00:00.000Z' },
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
      },
      {
        id: 'Bright-Rain On Leaves Loop.mp3',
        url: 'https://cdn.example.com/Bright-Rain On Leaves Loop.mp3?v=2026-01-02T00%3A00%3A00.000Z',
        name: 'Rain On Leaves Loop',
        mood: 'bright',
      },
    ]);
  });

  it('gives an entry with no hyphen a null mood', async () => {
    mockList.mockResolvedValue({
      data: [{ id: '1', name: 'rain.mp3', updated_at: '2026-01-01T00:00:00.000Z' }],
      error: null,
    });

    const result = await listAmbientTracks();

    expect(result).toEqual([
      { id: 'rain.mp3', url: 'https://cdn.example.com/rain.mp3?v=2026-01-01T00%3A00%3A00.000Z', name: 'Rain', mood: null },
    ]);
  });

  it('excludes placeholder folder entries (id: null)', async () => {
    mockList.mockResolvedValue({
      data: [
        { id: null, name: '.emptyFolderPlaceholder' },
        { id: '1', name: 'Still-Rain.mp3', updated_at: '2026-01-01T00:00:00.000Z' },
      ],
      error: null,
    });

    const result = await listAmbientTracks();

    expect(result).toEqual([
      {
        id: 'Still-Rain.mp3',
        url: 'https://cdn.example.com/Still-Rain.mp3?v=2026-01-01T00%3A00%3A00.000Z',
        name: 'Rain',
        mood: 'still',
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

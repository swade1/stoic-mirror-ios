import { listAmbientTracks, deriveTrackName } from './ambientTracks';

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
  it('replaces hyphens with spaces and title-cases each word', () => {
    expect(deriveTrackName('rain-on-leaves.mp3')).toBe('Rain On Leaves');
  });

  it('replaces underscores the same way', () => {
    expect(deriveTrackName('ocean_waves.m4a')).toBe('Ocean Waves');
  });

  it('collapses repeated separators', () => {
    expect(deriveTrackName('quiet--forest.wav')).toBe('Quiet Forest');
  });

  it('handles a single word with no separators', () => {
    expect(deriveTrackName('rain.mp3')).toBe('Rain');
  });

  it('trims leading and trailing separators', () => {
    expect(deriveTrackName('-soft-piano-.mp3')).toBe('Soft Piano');
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

  it('lists bucket contents as sorted {id, url, name} entries', async () => {
    mockList.mockResolvedValue({
      data: [
        { id: '2', name: 'rain-on-leaves.mp3' },
        { id: '1', name: 'evening-birdsong.mp3' },
      ],
      error: null,
    });

    const result = await listAmbientTracks();

    expect(result).toEqual([
      { id: 'evening-birdsong.mp3', url: 'https://cdn.example.com/evening-birdsong.mp3', name: 'Evening Birdsong' },
      { id: 'rain-on-leaves.mp3', url: 'https://cdn.example.com/rain-on-leaves.mp3', name: 'Rain On Leaves' },
    ]);
  });

  it('excludes placeholder folder entries (id: null)', async () => {
    mockList.mockResolvedValue({
      data: [
        { id: null, name: '.emptyFolderPlaceholder' },
        { id: '1', name: 'rain.mp3' },
      ],
      error: null,
    });

    const result = await listAmbientTracks();

    expect(result).toEqual([{ id: 'rain.mp3', url: 'https://cdn.example.com/rain.mp3', name: 'Rain' }]);
  });

  it('throws when the Storage API returns an error', async () => {
    mockList.mockResolvedValue({ data: null, error: new Error('network down') });

    await expect(listAmbientTracks()).rejects.toThrow('network down');
  });

  it('pages through the bucket when a single call returns a full page', async () => {
    const firstPage = Array.from({ length: 100 }, (_, i) => ({
      id: String(i),
      name: `track-${String(i).padStart(3, '0')}.mp3`,
    }));
    const secondPage = [{ id: '100', name: 'final-track.mp3' }];
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

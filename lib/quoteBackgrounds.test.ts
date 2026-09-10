import { listQuoteBackgrounds, resolveQuoteBackground } from './quoteBackgrounds';

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

describe('listQuoteBackgrounds', () => {
  beforeEach(() => {
    mockList.mockReset();
    mockGetPublicUrl.mockReset();
    mockGetPublicUrl.mockImplementation((path: string) => ({
      data: { publicUrl: `https://cdn.example.com/${path}` },
    }));
  });

  it('lists bucket contents as sorted {id, url} pairs', async () => {
    mockList.mockResolvedValue({
      data: [
        { id: '2', name: 'sunset.jpg' },
        { id: '1', name: 'mountain.jpg' },
      ],
      error: null,
    });

    const result = await listQuoteBackgrounds();

    expect(result).toEqual([
      { id: 'mountain.jpg', url: 'https://cdn.example.com/mountain.jpg' },
      { id: 'sunset.jpg', url: 'https://cdn.example.com/sunset.jpg' },
    ]);
  });

  it('excludes placeholder folder entries (id: null)', async () => {
    mockList.mockResolvedValue({
      data: [
        { id: null, name: '.emptyFolderPlaceholder' },
        { id: '1', name: 'mountain.jpg' },
      ],
      error: null,
    });

    const result = await listQuoteBackgrounds();

    expect(result).toEqual([{ id: 'mountain.jpg', url: 'https://cdn.example.com/mountain.jpg' }]);
  });

  it('throws when the Storage API returns an error', async () => {
    mockList.mockResolvedValue({ data: null, error: new Error('network down') });

    await expect(listQuoteBackgrounds()).rejects.toThrow('network down');
  });
});

describe('resolveQuoteBackground', () => {
  const backgrounds = [
    { id: 'mountain.jpg', url: 'https://cdn.example.com/mountain.jpg' },
    { id: 'sunset.jpg', url: 'https://cdn.example.com/sunset.jpg' },
    { id: 'forest.jpg', url: 'https://cdn.example.com/forest.jpg' },
    { id: 'ocean.jpg', url: 'https://cdn.example.com/ocean.jpg' },
  ];

  it('returns null when the collection is empty', () => {
    expect(resolveQuoteBackground([], 'mountain.jpg', 'quote-1')).toBeNull();
  });

  it('returns the matching background when the id exists', () => {
    expect(resolveQuoteBackground(backgrounds, 'sunset.jpg', 'quote-1')).toEqual(backgrounds[1]);
  });

  it('is deterministic: the same seed always resolves to the same fallback', () => {
    const first = resolveQuoteBackground(backgrounds, null, 'quote-abc-123');
    const second = resolveQuoteBackground(backgrounds, null, 'quote-abc-123');
    expect(first).toEqual(second);
  });

  it('spreads quotes without an explicit choice across different backgrounds, not just the first', () => {
    const seeds = ['quote-1', 'quote-2', 'quote-3', 'quote-4', 'quote-5', 'quote-6'];
    const resolvedIds = seeds.map((seed) => resolveQuoteBackground(backgrounds, null, seed)?.id);
    expect(new Set(resolvedIds).size).toBeGreaterThan(1);
  });

  it('falls back to a seed-derived background when the stored id no longer exists', () => {
    const result = resolveQuoteBackground(backgrounds, 'deleted-photo.jpg', 'quote-1');
    expect(result).not.toBeNull();
    expect(backgrounds.map((b) => b.id)).toContain(result!.id);
  });
});

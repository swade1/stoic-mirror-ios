import {
  listQuoteBackgrounds,
  resolveQuoteBackground,
  deriveCategoryFromFilename,
  getBackgroundCategories,
  withCacheBust,
} from './quoteBackgrounds';

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

  it('lists bucket contents as sorted {id, url, category} entries, with the URL cache-busted by updated_at', async () => {
    mockList.mockResolvedValue({
      data: [
        { id: '2', name: 'sunset-garden.jpg', updated_at: '2026-01-02T00:00:00.000Z' },
        { id: '1', name: 'mountain.jpg', updated_at: '2026-01-01T00:00:00.000Z' },
      ],
      error: null,
    });

    const result = await listQuoteBackgrounds();

    expect(result).toEqual([
      {
        id: 'mountain.jpg',
        url: 'https://cdn.example.com/mountain.jpg?v=2026-01-01T00%3A00%3A00.000Z',
        category: null,
      },
      {
        id: 'sunset-garden.jpg',
        url: 'https://cdn.example.com/sunset-garden.jpg?v=2026-01-02T00%3A00%3A00.000Z',
        category: 'sunset',
      },
    ]);
  });

  it('excludes placeholder folder entries (id: null)', async () => {
    mockList.mockResolvedValue({
      data: [
        { id: null, name: '.emptyFolderPlaceholder' },
        { id: '1', name: 'mountain.jpg', updated_at: '2026-01-01T00:00:00.000Z' },
      ],
      error: null,
    });

    const result = await listQuoteBackgrounds();

    expect(result).toEqual([
      {
        id: 'mountain.jpg',
        url: 'https://cdn.example.com/mountain.jpg?v=2026-01-01T00%3A00%3A00.000Z',
        category: null,
      },
    ]);
  });

  it('throws when the Storage API returns an error', async () => {
    mockList.mockResolvedValue({ data: null, error: new Error('network down') });

    await expect(listQuoteBackgrounds()).rejects.toThrow('network down');
  });
});

describe('resolveQuoteBackground', () => {
  const backgrounds = [
    { id: 'mountain.jpg', url: 'https://cdn.example.com/mountain.jpg', category: null },
    { id: 'sunset.jpg', url: 'https://cdn.example.com/sunset.jpg', category: null },
    { id: 'forest.jpg', url: 'https://cdn.example.com/forest.jpg', category: null },
    { id: 'ocean.jpg', url: 'https://cdn.example.com/ocean.jpg', category: null },
  ];

  it('returns null when the collection is empty', () => {
    expect(resolveQuoteBackground([], 'mountain.jpg')).toBeNull();
  });

  it('returns null when no choice has been made yet', () => {
    expect(resolveQuoteBackground(backgrounds, null)).toBeNull();
  });

  it('returns the matching background when the id exists', () => {
    expect(resolveQuoteBackground(backgrounds, 'sunset.jpg')).toEqual(backgrounds[1]);
  });

  it('returns null when the stored id no longer exists in the bucket', () => {
    expect(resolveQuoteBackground(backgrounds, 'deleted-photo.jpg')).toBeNull();
  });
});

describe('deriveCategoryFromFilename', () => {
  it('takes the text before the first hyphen', () => {
    expect(deriveCategoryFromFilename('sunset-garden.jpg')).toBe('sunset');
  });

  it('lowercases the category', () => {
    expect(deriveCategoryFromFilename('Sunset-Garden.jpg')).toBe('sunset');
  });

  it('uses only the first hyphen when there are several', () => {
    expect(deriveCategoryFromFilename('beach-palm-tree.png')).toBe('beach');
  });

  it('returns null when there is no hyphen', () => {
    expect(deriveCategoryFromFilename('mountain.jpg')).toBeNull();
  });

  it('returns null when the filename starts with a hyphen', () => {
    expect(deriveCategoryFromFilename('-untitled.jpg')).toBeNull();
  });

  it('ignores the file extension', () => {
    expect(deriveCategoryFromFilename('waterfall-01.jpeg')).toBe('waterfall');
  });
});

describe('getBackgroundCategories', () => {
  it('returns the distinct categories, sorted alphabetically', () => {
    const backgrounds = [
      { id: '1', url: 'a', category: 'sunset' },
      { id: '2', url: 'b', category: 'beach' },
      { id: '3', url: 'c', category: 'sunset' },
      { id: '4', url: 'd', category: 'ocean' },
    ];
    expect(getBackgroundCategories(backgrounds)).toEqual(['beach', 'ocean', 'sunset']);
  });

  it('ignores backgrounds with no category', () => {
    const backgrounds = [
      { id: '1', url: 'a', category: 'sunset' },
      { id: '2', url: 'b', category: null },
    ];
    expect(getBackgroundCategories(backgrounds)).toEqual(['sunset']);
  });

  it('returns an empty array when nothing is categorized', () => {
    const backgrounds = [
      { id: '1', url: 'a', category: null },
      { id: '2', url: 'b', category: null },
    ];
    expect(getBackgroundCategories(backgrounds)).toEqual([]);
  });

  it('returns an empty array for an empty list', () => {
    expect(getBackgroundCategories([])).toEqual([]);
  });
});

describe('withCacheBust', () => {
  it('appends the timestamp as a URL-encoded query param', () => {
    expect(withCacheBust('https://cdn.example.com/mountain.jpg', '2026-01-01T00:00:00.000Z')).toBe(
      'https://cdn.example.com/mountain.jpg?v=2026-01-01T00%3A00%3A00.000Z'
    );
  });

  it('returns the URL unchanged when there is no timestamp', () => {
    expect(withCacheBust('https://cdn.example.com/mountain.jpg', null)).toBe(
      'https://cdn.example.com/mountain.jpg'
    );
    expect(withCacheBust('https://cdn.example.com/mountain.jpg', undefined)).toBe(
      'https://cdn.example.com/mountain.jpg'
    );
  });

  it('gives two different timestamps two different URLs', () => {
    const first = withCacheBust('https://cdn.example.com/mountain.jpg', '2026-01-01T00:00:00.000Z');
    const second = withCacheBust('https://cdn.example.com/mountain.jpg', '2026-01-02T00:00:00.000Z');
    expect(first).not.toBe(second);
  });
});

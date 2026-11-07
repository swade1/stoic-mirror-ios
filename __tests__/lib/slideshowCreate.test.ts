import { Alert } from 'react-native';
import { showNamePrompt } from '@/lib/namePrompt';
import { createSlideshow, promptNewSlideshow, DEFAULT_SLIDESHOW_NAME } from '@/lib/slideshowCreate';

const mockBuilder: Record<string, jest.Mock> = {};
let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } };

jest.mock('@/lib/namePrompt', () => ({ showNamePrompt: jest.fn() }));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getSession: () => Promise.resolve({ data: { session: mockSession } }) },
    from: () => mockBuilder,
  },
}));


beforeEach(() => {
  mockSession = { user: { id: 'user-1' } };
  mockBuilder.select = jest.fn(() => mockBuilder);
  mockBuilder.eq = jest.fn(() => mockBuilder);
  mockBuilder.order = jest.fn(() => mockBuilder);
  mockBuilder.limit = jest.fn(() => Promise.resolve({ data: [{ sort_order: 2 }] }));
  mockBuilder.insert = jest.fn(() => mockBuilder);
  mockBuilder.single = jest.fn(() => Promise.resolve({ data: { id: 'new-id' }, error: null }));
});

describe('createSlideshow', () => {
  it('inserts after the existing slideshows and returns the new id', async () => {
    await expect(createSlideshow('  Evening  ')).resolves.toBe('new-id');
    expect(mockBuilder.insert).toHaveBeenCalledWith({ user_id: 'user-1', name: 'Evening', sort_order: 3 });
  });

  it('starts at 0 when there are none, and falls back to the default name', async () => {
    mockBuilder.limit = jest.fn(() => Promise.resolve({ data: [] }));
    await createSlideshow('   ');
    expect(mockBuilder.insert).toHaveBeenCalledWith({ user_id: 'user-1', name: DEFAULT_SLIDESHOW_NAME, sort_order: 0 });
  });

  it('rejects when signed out', async () => {
    mockSession = null;
    await expect(createSlideshow('x')).rejects.toThrow(/sign in/i);
  });
});

describe('promptNewSlideshow', () => {
  const mockShow = showNamePrompt as jest.Mock;
  beforeEach(() => mockShow.mockClear());

  it('shows an empty name box with a placeholder, then creates and reports the id', async () => {
    const onCreated = jest.fn();
    promptNewSlideshow(onCreated);

    const opts = mockShow.mock.calls[0][0];
    expect(opts.title).toBe('Name your slideshow');
    expect(opts.placeholder).toBe('Slideshow Name');
    expect(opts.defaultValue).toBeUndefined();
    opts.onSubmit('Morning');

    await new Promise((r) => setTimeout(r, 0));
    expect(mockBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Morning' }));
    expect(onCreated).toHaveBeenCalledWith('new-id');
  });

  it('falls back to the default name when left blank', async () => {
    promptNewSlideshow(jest.fn());
    mockShow.mock.calls[0][0].onSubmit('');
    await new Promise((r) => setTimeout(r, 0));
    expect(mockBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ name: DEFAULT_SLIDESHOW_NAME }));
  });

  it('creates nothing until the dialog is submitted', () => {
    const onCreated = jest.fn();
    promptNewSlideshow(onCreated);
    expect(mockBuilder.insert).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
  });

  it('alerts instead of opening anything when creation fails', async () => {
    mockBuilder.single = jest.fn(() => Promise.resolve({ data: null, error: new Error('db down') }));
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onCreated = jest.fn();
    promptNewSlideshow(onCreated);
    mockShow.mock.calls[0][0].onSubmit('x');
    await new Promise((r) => setTimeout(r, 0));
    expect(onCreated).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Could Not Create Slideshow', 'db down');
    alertSpy.mockRestore();
  });
});

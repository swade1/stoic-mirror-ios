import { Alert } from 'react-native';
import { createSlideshow, promptNewSlideshow, DEFAULT_SLIDESHOW_NAME } from '@/lib/slideshowCreate';

const mockBuilder: Record<string, jest.Mock> = {};
let mockSession: { user: { id: string } } | null = { user: { id: 'user-1' } };

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
  it('asks for a name, creates the slideshow, and reports its id', async () => {
    const promptSpy = jest.spyOn(Alert, 'prompt').mockImplementation(() => {});
    const onCreated = jest.fn();
    promptNewSlideshow(onCreated);

    expect(promptSpy.mock.calls[0][0]).toBe('Name your slideshow');
    expect(promptSpy.mock.calls[0][4]).toBe(DEFAULT_SLIDESHOW_NAME);
    const buttons = promptSpy.mock.calls[0][2] as { text: string; onPress?: (v?: string) => void }[];
    buttons.find((b) => b.text === 'Create')!.onPress!('Morning');

    await new Promise((r) => setTimeout(r, 0));
    expect(mockBuilder.insert).toHaveBeenCalledWith(expect.objectContaining({ name: 'Morning' }));
    expect(onCreated).toHaveBeenCalledWith('new-id');
    promptSpy.mockRestore();
  });

  it('does not create anything if the prompt is cancelled', () => {
    const promptSpy = jest.spyOn(Alert, 'prompt').mockImplementation(() => {});
    const onCreated = jest.fn();
    promptNewSlideshow(onCreated);
    const buttons = promptSpy.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    expect(buttons.find((b) => b.text === 'Cancel')!.onPress).toBeUndefined();
    expect(mockBuilder.insert).not.toHaveBeenCalled();
    expect(onCreated).not.toHaveBeenCalled();
    promptSpy.mockRestore();
  });

  it('alerts instead of opening anything when creation fails', async () => {
    mockBuilder.single = jest.fn(() => Promise.resolve({ data: null, error: new Error('db down') }));
    const promptSpy = jest.spyOn(Alert, 'prompt').mockImplementation(() => {});
    const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onCreated = jest.fn();
    promptNewSlideshow(onCreated);
    (promptSpy.mock.calls[0][2] as { text: string; onPress?: (v?: string) => void }[])
      .find((b) => b.text === 'Create')!.onPress!('x');
    await new Promise((r) => setTimeout(r, 0));
    expect(onCreated).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledWith('Could Not Create Slideshow', 'db down');
    promptSpy.mockRestore();
    alertSpy.mockRestore();
  });
});

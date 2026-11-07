import { Alert, Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

export const DEFAULT_SLIDESHOW_NAME = 'My Slideshow';

// Creates an empty slideshow for the signed-in user and returns its id.
// sort_order goes after the user's existing slideshows, matching what the
// Slideshows list did when it created them itself.
export async function createSlideshow(name: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in to create a slideshow.');

  const { data: last } = await supabase
    .from('slideshow_collections')
    .select('sort_order')
    .eq('user_id', session.user.id)
    .order('sort_order', { ascending: false })
    .limit(1);
  const nextOrder = last && last.length > 0 ? last[0].sort_order + 1 : 0;

  const { data, error } = await supabase
    .from('slideshow_collections')
    .insert({ user_id: session.user.id, name: name.trim() || DEFAULT_SLIDESHOW_NAME, sort_order: nextOrder })
    .select('id')
    .single();
  if (error || !data) throw error ?? new Error('Could not create the slideshow.');
  return data.id as string;
}

// The single entry point for "make a slideshow" from anywhere in the app
// (Saved Wisdom banner, the post-save nudge, the Slideshows list). Asks for
// a name (iOS prompt; a default name elsewhere), creates it, then hands the
// new slideshow's id to `onCreated` so the caller can open it.
export function promptNewSlideshow(onCreated: (collectionId: string) => void) {
  const create = async (rawName?: string) => {
    try {
      const id = await createSlideshow(rawName ?? DEFAULT_SLIDESHOW_NAME);
      onCreated(id);
    } catch (err) {
      Alert.alert(
        'Could Not Create Slideshow',
        err instanceof Error ? err.message : 'Something went wrong. Please try again.'
      );
    }
  };

  if (Platform.OS === 'ios') {
    Alert.prompt(
      'Name your slideshow',
      'You can change it later.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Create', onPress: (value?: string) => create(value) },
      ],
      'plain-text',
      DEFAULT_SLIDESHOW_NAME
    );
  } else {
    create();
  }
}

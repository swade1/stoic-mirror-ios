import { supabase } from '@/lib/supabase';
import { deletePersonalFilesForSoundtrack } from '@/lib/ambientPlaylist';

export interface Soundtrack {
  id: string;
  name: string;
  trackCount: number;
  // Names of the slideshows this soundtrack is currently assigned to —
  // now that the same soundtrack can serve several slideshows at once, a
  // track count alone doesn't say where it's actually playing.
  usedByNames: string[];
}

// Lists a user's saved soundtracks with how many tracks each holds and
// which slideshows currently use it — one query for the soundtracks
// themselves, one for their playlist items, one for the collections
// pointing at them, all grouped client-side, the same pattern
// slideshow-collections.tsx already uses to attach a photo count to each
// collection from a separate query.
export async function listSoundtracksWithCounts(userId: string): Promise<Soundtrack[]> {
  const [{ data: soundtrackRows, error }, { data: itemRows }, { data: collectionRows }] = await Promise.all([
    supabase.from('soundtracks').select('id, name').eq('user_id', userId).order('name', { ascending: true }),
    supabase.from('slideshow_ambient_playlist_items').select('soundtrack_id').eq('user_id', userId),
    supabase.from('slideshow_collections').select('name, soundtrack_id').eq('user_id', userId).not('soundtrack_id', 'is', null),
  ]);
  if (error) throw error;

  const countsBySoundtrack = new Map<string, number>();
  (itemRows ?? []).forEach((row) => {
    countsBySoundtrack.set(row.soundtrack_id, (countsBySoundtrack.get(row.soundtrack_id) ?? 0) + 1);
  });

  const usedByBySoundtrack = new Map<string, string[]>();
  (collectionRows ?? []).forEach((row) => {
    if (!row.soundtrack_id) return;
    const names = usedByBySoundtrack.get(row.soundtrack_id) ?? [];
    names.push(row.name);
    usedByBySoundtrack.set(row.soundtrack_id, names);
  });

  return (soundtrackRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    trackCount: countsBySoundtrack.get(row.id) ?? 0,
    usedByNames: usedByBySoundtrack.get(row.id) ?? [],
  }));
}

export async function createSoundtrack(userId: string, name: string): Promise<string> {
  const { data, error } = await supabase
    .from('soundtracks')
    .insert({ user_id: userId, name })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function renameSoundtrack(id: string, name: string): Promise<void> {
  const { error } = await supabase.from('soundtracks').update({ name }).eq('id', id);
  if (error) throw error;
}

// Deletes a soundtrack entirely. Any collection that had it assigned
// falls back to no soundtrack automatically (slideshow_collections.
// soundtrack_id is ON DELETE SET NULL) — this never touches or deletes
// the slideshows themselves, only the soundtrack they were pointing at.
export async function deleteSoundtrack(id: string): Promise<void> {
  await deletePersonalFilesForSoundtrack(id);
  const { error } = await supabase.from('soundtracks').delete().eq('id', id);
  if (error) throw error;
}

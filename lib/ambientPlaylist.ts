import { supabase } from '@/lib/supabase';
import { savePersonalAmbientTrack, deletePersonalAmbientTrack } from '@/lib/personalAmbientTrack';

export interface PlaylistItem {
  id: string;
  soundtrackId: string;
  sortOrder: number;
  sourceType: 'curated' | 'personal';
  curatedTrackId: string | null;
  personalFileName: string | null;
}

interface PlaylistItemRow {
  id: string;
  soundtrack_id: string;
  sort_order: number;
  source_type: string;
  curated_track_id: string | null;
  personal_file_name: string | null;
}

function fromRow(row: PlaylistItemRow): PlaylistItem {
  return {
    id: row.id,
    soundtrackId: row.soundtrack_id,
    sortOrder: row.sort_order,
    sourceType: row.source_type === 'personal' ? 'personal' : 'curated',
    curatedTrackId: row.curated_track_id,
    personalFileName: row.personal_file_name,
  };
}

// The ordered track list for one soundtrack — mixing curated and personal
// items, mirroring how slideshow_photos already lists a collection's
// ordered photos.
export async function listPlaylistItems(soundtrackId: string): Promise<PlaylistItem[]> {
  const { data, error } = await supabase
    .from('slideshow_ambient_playlist_items')
    .select('id, soundtrack_id, sort_order, source_type, curated_track_id, personal_file_name')
    .eq('soundtrack_id', soundtrackId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data ?? []).map(fromRow);
}

// Appends a curated track to the end of a soundtrack's playlist. Queries
// the current max sort_order rather than requiring the caller to track
// it — lists here are always small, so the extra read is cheap, and it
// keeps "add a track" a one-call operation for the picker screen.
export async function addCuratedItem(soundtrackId: string, userId: string, trackId: string): Promise<void> {
  const items = await listPlaylistItems(soundtrackId);
  const nextSortOrder = items.length > 0 ? Math.max(...items.map((i) => i.sortOrder)) + 1 : 0;
  const { error } = await supabase.from('slideshow_ambient_playlist_items').insert({
    soundtrack_id: soundtrackId,
    user_id: userId,
    sort_order: nextSortOrder,
    source_type: 'curated',
    curated_track_id: trackId,
  });
  if (error) throw error;
}

// Appends a personal (picked-from-device) track. The row is inserted
// first so its generated id exists, then that id is what the local file
// gets saved under (lib/personalAmbientTrack.ts is keyed by item id, not
// soundtrack id, since a soundtrack can hold more than one personal
// track).
export async function addPersonalItem(
  soundtrackId: string,
  userId: string,
  pickedUri: string,
  originalFilename: string
): Promise<void> {
  const items = await listPlaylistItems(soundtrackId);
  const nextSortOrder = items.length > 0 ? Math.max(...items.map((i) => i.sortOrder)) + 1 : 0;
  const { data, error } = await supabase
    .from('slideshow_ambient_playlist_items')
    .insert({
      soundtrack_id: soundtrackId,
      user_id: userId,
      sort_order: nextSortOrder,
      source_type: 'personal',
      personal_file_name: originalFilename,
    })
    .select('id')
    .single();
  if (error) throw error;
  savePersonalAmbientTrack(data.id, pickedUri, originalFilename);
}

// Removes one playlist item — deleting its local file first when personal
// (a curated item has nothing on-device to clean up), then the row
// itself. Doesn't renumber the remaining items' sort_order; gaps are
// harmless since listPlaylistItems only ever depends on relative order.
export async function removeItem(item: PlaylistItem): Promise<void> {
  if (item.sourceType === 'personal') {
    deletePersonalAmbientTrack(item.id);
  }
  const { error } = await supabase.from('slideshow_ambient_playlist_items').delete().eq('id', item.id);
  if (error) throw error;
}

// Persists a full reorder — rewrites every item's sort_order from its
// position in the given array. Lists here are always small (single
// digits), so a full rewrite on every reorder is simpler to reason about
// than computing minimal incremental swaps, at negligible cost.
export async function reorderItems(items: PlaylistItem[]): Promise<void> {
  await Promise.all(
    items.map((item, index) =>
      supabase.from('slideshow_ambient_playlist_items').update({ sort_order: index }).eq('id', item.id)
    )
  );
}

// Cleans up every personal item's on-device file for a soundtrack that's
// about to be deleted — the DB rows themselves cascade automatically via
// the table's soundtrack_id foreign key, but nothing deletes local files
// for you.
export async function deletePersonalFilesForSoundtrack(soundtrackId: string): Promise<void> {
  const items = await listPlaylistItems(soundtrackId);
  items.filter((item) => item.sourceType === 'personal').forEach((item) => deletePersonalAmbientTrack(item.id));
}

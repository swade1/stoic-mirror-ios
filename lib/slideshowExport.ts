import { Directory, File, Paths } from 'expo-file-system';
import { supabase } from '@/lib/supabase';
import { listAmbientTracks, type AmbientTrack } from '@/lib/ambientTracks';
import { listPlaylistItems, type PlaylistItem } from '@/lib/ambientPlaylist';
import { resolvePersonalAmbientTrackUri } from '@/lib/personalAmbientTrack';
import { resolveSlideshowAssetUri } from '@/lib/slideshowAssets';
import { exportVideo } from '@/modules/slideshow-export';

const DEFAULT_DURATION_SECONDS = 7;
// Music in the exported file plays at a fixed, clearly audible level rather
// than the in-app Volume setting, which is tuned for quiet background play.
const EXPORT_AUDIO_GAIN = 0.8;
export const EXPORT_WATERMARK = 'The Stoic Mirror';

// Curated tracks live in Supabase Storage; the exporter needs a local file.
// Downloaded once per track URL and reused.
async function localCuratedTrack(track: AmbientTrack): Promise<string> {
  const dir = new Directory(Paths.cache, 'export-audio');
  dir.create({ intermediates: true, idempotent: true });
  const safeName = track.id.replace(/[^a-zA-Z0-9._-]/g, '_');
  const file = new File(dir, `${safeName}.mp3`);
  if (!file.exists) {
    await File.downloadFileAsync(track.url, file);
  }
  return file.uri;
}

// Renders the slideshow (slides, transition, duration, soundtrack) to an MP4
// in the cache directory and returns its file:// URI.
export async function exportSlideshowVideo(collectionId: string): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Please sign in first.');

  const [{ data: photoRows, error }, { data: collectionRow }, ambientTracks] = await Promise.all([
    supabase
      .from('slideshow_photos')
      .select('asset_id')
      .eq('user_id', session.user.id)
      .eq('collection_id', collectionId)
      .order('sort_order', { ascending: true }),
    supabase
      .from('slideshow_collections')
      .select('slideshow_duration_seconds, slideshow_transition, soundtrack_id')
      .eq('id', collectionId)
      .single(),
    listAmbientTracks().catch(() => [] as AmbientTrack[]),
  ]);
  if (error || !photoRows) throw new Error('Could not load the slideshow.');

  const resolved = await Promise.all(photoRows.map((row) => resolveSlideshowAssetUri(row.asset_id)));
  const imageUris = resolved.filter((u): u is string => !!u);
  if (imageUris.length === 0) throw new Error('This slideshow has no slides that can be exported.');

  const playlistItems = collectionRow?.soundtrack_id
    ? await listPlaylistItems(collectionRow.soundtrack_id).catch(() => [] as PlaylistItem[])
    : [];
  const audioUris: string[] = [];
  for (const item of playlistItems) {
    if (item.sourceType === 'curated') {
      const track = ambientTracks.find((t) => t.id === item.curatedTrackId);
      if (!track) continue;
      try {
        audioUris.push(await localCuratedTrack(track));
      } catch {
        // A track that can't be fetched is skipped, as on playback.
      }
    } else {
      const uri = resolvePersonalAmbientTrackUri(item.id, item.personalFileName ?? '');
      if (uri) audioUris.push(uri);
    }
  }

  const outDir = new Directory(Paths.cache, 'exports');
  outDir.create({ intermediates: true, idempotent: true });
  const outFile = new File(outDir, `slideshow-${Date.now()}.mp4`);

  return exportVideo({
    imageUris,
    secondsPerSlide: collectionRow?.slideshow_duration_seconds ?? DEFAULT_DURATION_SECONDS,
    transition: collectionRow?.slideshow_transition === 'slide' ? 'slide' : 'fade',
    audioUris,
    audioGain: EXPORT_AUDIO_GAIN,
    outputUri: outFile.uri,
    watermark: EXPORT_WATERMARK,
  });
}

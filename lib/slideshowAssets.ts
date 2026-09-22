import * as MediaLibrary from 'expo-media-library';

// localUri only — info.uri (the ph:// asset-library reference some
// iCloud-only photos fall back to when they haven't finished downloading
// locally) isn't something expo-image can actually render, so a photo
// that resolves to a bare `uri` is treated the same as one that doesn't
// resolve at all. Shared by every screen that touches a slideshow_photos
// asset_id (collections list, per-collection management, playback) so
// "missing" means the same thing everywhere — they previously disagreed,
// which let a photo show fine as a thumbnail while going blank on actual
// playback.
export async function resolveSlideshowAssetUri(assetId: string): Promise<string | null> {
  try {
    const info = await MediaLibrary.getAssetInfoAsync(assetId);
    return info?.localUri ?? null;
  } catch {
    return null;
  }
}

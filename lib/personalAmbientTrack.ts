import { Directory, File, Paths } from 'expo-file-system';

const ROOT_DIRECTORY_NAME = 'personal-ambient-tracks';

// Derives the extension to give the locally-stored copy of a personal
// ambient track, from the filename the user picked — e.g. "My Song.mp3"
// -> ".mp3". Falls back to no extension when the picked filename doesn't
// have one; expo-audio doesn't need a correct extension to play a file,
// so this is cosmetic, not a correctness requirement.
export function derivePersonalTrackExtension(filename: string): string {
  const match = filename.match(/\.[^.]+$/);
  return match ? match[0] : '';
}

// Keyed by the ambient-playlist item's own id, not the collection's — a
// collection can hold several personal tracks now (one playlist item
// each), so each needs its own storage slot rather than sharing one
// fixed-per-collection location.
function getPersonalAmbientTrackDirectory(itemId: string): Directory {
  return new Directory(Paths.document, ROOT_DIRECTORY_NAME, itemId);
}

// The on-disk file always has a fixed basename ("track<ext>"), independent
// of the name the user's original file had — that display name lives only
// in the playlist item's personal_file_name column, never parsed back into
// a path. Keeping the on-disk name fixed means replacing a track is just
// "delete the directory, copy the new one in" (see savePersonalAmbientTrack),
// with no need to ever know the previous file's name first.
export function getPersonalAmbientTrackFile(itemId: string, originalFilename: string): File {
  return new File(getPersonalAmbientTrackDirectory(itemId), `track${derivePersonalTrackExtension(originalFilename)}`);
}

// Copies a freshly-picked file into permanent local storage for this
// playlist item, replacing whatever was there before. Deletes the whole
// directory first rather than overwriting just the destination file —
// the new file's extension may differ from the old one's, which would
// otherwise leave a stale file with the wrong extension behind it. Since
// an item's id only exists once its row is inserted, this is always
// called after that insert, with the id it returned.
export function savePersonalAmbientTrack(itemId: string, pickedUri: string, originalFilename: string): void {
  const directory = getPersonalAmbientTrackDirectory(itemId);
  try {
    if (directory.exists) directory.delete();
  } catch {
    // Nothing to clean up — fall through and create it fresh below.
  }
  directory.create({ intermediates: true, idempotent: true });
  new File(pickedUri).copy(getPersonalAmbientTrackFile(itemId, originalFilename));
}

// Removes one playlist item's personal track file entirely — used both
// when the user removes that item (or a collection is deleted) so no file
// is ever left orphaned on device.
export function deletePersonalAmbientTrack(itemId: string): void {
  try {
    const directory = getPersonalAmbientTrackDirectory(itemId);
    if (directory.exists) directory.delete();
  } catch {
    // Already gone, or never existed — nothing to do.
  }
}

// Resolves a playlist item's personal track to a playable local URI, or
// null if the file is missing (e.g. local storage was cleared) — the same
// tolerant treatment slideshow-photos.tsx gives a Photos asset that's been
// deleted since being added: silently absent, not an error, since there's
// nothing more meaningful to show than "skip this item right now."
export function resolvePersonalAmbientTrackUri(itemId: string, originalFilename: string): string | null {
  try {
    const file = getPersonalAmbientTrackFile(itemId, originalFilename);
    return file.exists ? file.uri : null;
  } catch {
    return null;
  }
}

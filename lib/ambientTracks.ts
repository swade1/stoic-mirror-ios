import { supabase } from '@/lib/supabase';

const BUCKET = 'ambient-tracks';
// Storage's list() caps a single call at 100 entries by default — this
// bucket is expected to stay small, but there's no reason to reintroduce
// the bug a similarly-unpaginated call caused for quote-backgrounds (see
// lib/quoteBackgrounds.ts), so this pages through the same way.
const LIST_PAGE_SIZE = 100;

export interface AmbientTrack {
  id: string;
  url: string;
  name: string;
  mood: string | null;
}

// Appends a cache-busting query param derived from the file's last-modified
// timestamp — same fix, same reason, as quoteBackgrounds.ts's withCacheBust:
// a Storage public URL never changes when a file is overwritten under the
// same name (e.g. re-normalizing a track's loudness), so any cache keyed
// purely on URL — a CDN in front of Storage, or the app's own audio/image
// cache — has no signal there's anything new to fetch. Folding updated_at
// into the URL means the URL itself changes whenever the file's content
// does, which is the only reliable way to invalidate those caches.
export function withCacheBust(url: string, updatedAt: string | null | undefined): string {
  if (!updatedAt) return url;
  return `${url}?v=${encodeURIComponent(updatedAt)}`;
}

// Turns a filename like "Bright-Rain On Leaves Loop.mp3" into a display
// name like "Rain On Leaves Loop" — dropping the mood prefix (see
// deriveTrackMood below), the same "category before the first hyphen"
// filename convention quote-backgrounds uses. A filename with no hyphen
// has no mood, and the whole (extension-stripped) name is used as-is.
export function deriveTrackName(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, '');
  const hyphenIndex = withoutExtension.indexOf('-');
  const nameOnly = hyphenIndex > 0 ? withoutExtension.slice(hyphenIndex + 1) : withoutExtension;
  return nameOnly
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// Derives a track's mood from the same filename convention — the text
// before the first hyphen, e.g. "Bright-Rain On Leaves Loop.mp3" -> "bright".
// Expected values are "bright" | "solemn" | "still" (see the
// prep-ambient-track skill for what each means and how a track is judged
// against them), but this doesn't validate against that set — an
// unrecognized or missing prefix just means the track has no mood filter
// applied to it rather than an error, the same tolerant treatment
// quote-backgrounds gives an uncategorized photo.
export function deriveTrackMood(filename: string): string | null {
  const withoutExtension = filename.replace(/\.[^.]+$/, '');
  const hyphenIndex = withoutExtension.indexOf('-');
  if (hyphenIndex <= 0) return null;
  return withoutExtension.slice(0, hyphenIndex).toLowerCase();
}

// Lists whatever audio files currently exist in the ambient-tracks
// Storage bucket. New tracks dropped into the bucket via the Supabase
// dashboard show up here on next call — no app update needed, matching
// how listQuoteBackgrounds already treats its bucket as the source of
// truth rather than a bundled/code-referenced list.
export async function listAmbientTracks(): Promise<AmbientTrack[]> {
  const files = [];
  for (let offset = 0; ; offset += LIST_PAGE_SIZE) {
    const { data, error } = await supabase.storage.from(BUCKET).list('', { limit: LIST_PAGE_SIZE, offset });
    if (error) throw error;
    files.push(...(data ?? []));
    if (!data || data.length < LIST_PAGE_SIZE) break;
  }

  return files
    .filter((file) => file.id !== null) // exclude the bucket's own placeholder folder entries
    .map((file) => ({
      id: file.name,
      url: withCacheBust(supabase.storage.from(BUCKET).getPublicUrl(file.name).data.publicUrl, file.updated_at),
      name: deriveTrackName(file.name),
      mood: deriveTrackMood(file.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

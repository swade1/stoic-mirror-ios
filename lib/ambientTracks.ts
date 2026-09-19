import { supabase } from '@/lib/supabase';

const BUCKET = 'ambient-tracks';
// Storage's list() caps a single call at 100 entries by default — this
// bucket is expected to stay small, but there's no reason to reintroduce
// the bug a similarly-unpaginated call caused for quote-backgrounds (see
// lib/quoteBackgrounds.ts), so this pages through the same way.
const LIST_PAGE_SIZE = 100;

export type TrackLength = 'short' | 'medium' | 'long';
// Fixed, meaningful order — short/medium/long, not alphabetical. Alphabetical
// would put "long" before "medium", which is wrong for a duration axis.
const TRACK_LENGTH_ORDER: TrackLength[] = ['short', 'medium', 'long'];

export interface AmbientTrack {
  id: string;
  url: string;
  name: string;
  mood: string | null;
  length: TrackLength | null;
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

function titleCase(text: string): string {
  return text
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function isTrackLength(value: string): value is TrackLength {
  return (TRACK_LENGTH_ORDER as string[]).includes(value);
}

// Parses the filename convention this bucket uses: an optional mood tag,
// an optional length tag, then the display name — e.g.
// "Bright-Short-Rain On Leaves.mp3" -> mood "bright", length "short", name
// "Rain On Leaves". Both tags are text before a hyphen; the length tag is
// only recognized (and consumed) when it's one of TRACK_LENGTH_ORDER's
// values — anything else is treated as part of the name instead, which is
// what keeps this backward compatible with every track uploaded before the
// length tag existed (mood-only filenames like "Bright-Rain On
// Leaves.mp3") without needing to rename any of them.
function parseFilename(filename: string): { mood: string | null; length: TrackLength | null; name: string } {
  const withoutExtension = filename.replace(/\.[^.]+$/, '');
  const firstHyphen = withoutExtension.indexOf('-');
  if (firstHyphen <= 0) {
    return { mood: null, length: null, name: titleCase(withoutExtension) };
  }

  const mood = withoutExtension.slice(0, firstHyphen).toLowerCase();
  const rest = withoutExtension.slice(firstHyphen + 1);

  const secondHyphen = rest.indexOf('-');
  if (secondHyphen > 0) {
    const candidateLength = rest.slice(0, secondHyphen).toLowerCase();
    if (isTrackLength(candidateLength)) {
      return { mood, length: candidateLength, name: titleCase(rest.slice(secondHyphen + 1)) };
    }
  }

  return { mood, length: null, name: titleCase(rest) };
}

// Turns a filename like "Bright-Short-Rain On Leaves Loop.mp3" into a
// display name like "Rain On Leaves Loop" — dropping the mood and length
// tags. A filename with neither tag has no hyphen, and the whole
// (extension-stripped) name is used as-is.
export function deriveTrackName(filename: string): string {
  return parseFilename(filename).name;
}

// Derives a track's mood from the filename convention — the text before
// the first hyphen, e.g. "Bright-Short-Rain On Leaves Loop.mp3" -> "bright".
// Expected values are "bright" | "solemn" | "still" (see the
// prep-ambient-track skill for what each means and how a track is judged
// against them), but this doesn't validate against that set — an
// unrecognized or missing prefix just means the track has no mood filter
// applied to it rather than an error, the same tolerant treatment
// quote-backgrounds gives an uncategorized photo.
export function deriveTrackMood(filename: string): string | null {
  return parseFilename(filename).mood;
}

// Derives a track's length bucket from the filename convention — the
// second hyphen-delimited segment, when present and recognized. Unlike
// mood, this is never a judgment call: the prep-ambient-track skill
// computes it directly from the track's measured duration (short: 3-5 min,
// medium: 6-9 min, long: 10+ min) before naming the file, so there's
// nothing here to get wrong the way a mood label could be.
export function deriveTrackLength(filename: string): TrackLength | null {
  return parseFilename(filename).length;
}

// The distinct moods present in a track list, sorted alphabetically — used
// to build the ambient-music picker's filter-chip row, the same way
// getBackgroundCategories builds one for quote-backgrounds. Tracks with no
// mood (no hyphen in the filename) don't contribute one.
export function getTrackMoods(tracks: AmbientTrack[]): string[] {
  const moods = new Set<string>();
  tracks.forEach((track) => {
    if (track.mood) moods.add(track.mood);
  });
  return Array.from(moods).sort();
}

// The distinct length buckets present in a track list, in short/medium/long
// order (not alphabetical — see TRACK_LENGTH_ORDER) — used to build the
// picker's length filter row, a second, independent filter alongside mood.
export function getTrackLengths(tracks: AmbientTrack[]): TrackLength[] {
  const present = new Set<TrackLength>();
  tracks.forEach((track) => {
    if (track.length) present.add(track.length);
  });
  return TRACK_LENGTH_ORDER.filter((length) => present.has(length));
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
      length: deriveTrackLength(file.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

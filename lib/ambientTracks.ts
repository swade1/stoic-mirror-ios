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
}

// Turns a filename like "rain-on-leaves.mp3" into a display name like
// "Rain On Leaves" — no category convention needed here the way
// quote-backgrounds has one, this bucket isn't expected to need filtering.
export function deriveTrackName(filename: string): string {
  const withoutExtension = filename.replace(/\.[^.]+$/, '');
  return withoutExtension
    .replace(/[-_]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
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
      url: supabase.storage.from(BUCKET).getPublicUrl(file.name).data.publicUrl,
      name: deriveTrackName(file.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

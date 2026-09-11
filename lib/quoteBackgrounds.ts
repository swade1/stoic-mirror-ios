import { supabase } from '@/lib/supabase';

const BUCKET = 'quote-backgrounds';

export interface QuoteBackground {
  id: string;
  url: string;
}

// Lists whatever photos currently exist in the quote-backgrounds Storage
// bucket. New photos dropped into the bucket via the Supabase dashboard
// show up here on next call — no app update needed, since the bucket is
// the source of truth, not a bundled/code-referenced list.
export async function listQuoteBackgrounds(): Promise<QuoteBackground[]> {
  const { data, error } = await supabase.storage.from(BUCKET).list();
  if (error) throw error;

  return (data ?? [])
    .filter((file) => file.id !== null) // exclude the bucket's own placeholder folder entries
    .map((file) => ({
      id: file.name,
      url: supabase.storage.from(BUCKET).getPublicUrl(file.name).data.publicUrl,
    }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

// Resolves a saved quote's chosen background against the current bucket
// contents. Returns null when there's no explicit choice yet, or the
// stored id no longer exists in the bucket (e.g. the photo was removed)
// — null means "show the picker," not "guess one." Earlier versions of
// this function auto-assigned a deterministic fallback photo, which made
// sense for a multi-card gallery showing every quote at once; the
// single-quote picker-then-editor flow doesn't need to guess anything.
export function resolveQuoteBackground(
  backgrounds: QuoteBackground[],
  backgroundPhotoId: string | null
): QuoteBackground | null {
  if (!backgroundPhotoId) return null;
  return backgrounds.find((b) => b.id === backgroundPhotoId) ?? null;
}

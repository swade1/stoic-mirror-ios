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

// Deterministic index from a string, so the same seed always lands on the
// same background (stable across renders/sessions) without needing to
// store anything — same idea as getDailyQuoteId's date-seeded index.
function hashToIndex(seed: string, length: number): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % length;
}

// Resolves a saved quote's chosen background against the current bucket
// contents. If the quote has no explicit choice yet (or its stored id no
// longer exists, e.g. the photo was removed), falls back to a photo
// chosen deterministically from `seed` (the quote's own id) — NOT always
// the first photo — so multiple not-yet-customized quotes spread across
// the available photos instead of all collapsing onto the same one.
export function resolveQuoteBackground(
  backgrounds: QuoteBackground[],
  backgroundPhotoId: string | null,
  seed: string
): QuoteBackground | null {
  if (backgrounds.length === 0) return null;
  const match = backgroundPhotoId
    ? backgrounds.find((b) => b.id === backgroundPhotoId)
    : undefined;
  return match ?? backgrounds[hashToIndex(seed, backgrounds.length)];
}

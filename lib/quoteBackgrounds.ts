import { supabase } from '@/lib/supabase';

const BUCKET = 'quote-backgrounds';

export interface QuoteBackground {
  id: string;
  url: string;
  category: string | null;
}

// Derives a background's category from a filename naming convention — the
// text before the first hyphen, e.g. "sunset-garden.jpg" -> "sunset". A
// filename with no hyphen has no category (the photo still shows under
// "All", it just doesn't get its own filter chip). This lets a photo be
// categorized just by naming it consistently when it's dropped into the
// bucket — no separate tagging step or database table needed while the
// collection is still small.
export function deriveCategoryFromFilename(filename: string): string | null {
  const withoutExtension = filename.replace(/\.[^.]+$/, '');
  const hyphenIndex = withoutExtension.indexOf('-');
  if (hyphenIndex <= 0) return null;
  return withoutExtension.slice(0, hyphenIndex).toLowerCase();
}

// The distinct categories present in a background list, sorted
// alphabetically — used to build the filter-chip row. Backgrounds with no
// category (no hyphen in the filename) don't contribute one.
export function getBackgroundCategories(backgrounds: QuoteBackground[]): string[] {
  const categories = new Set<string>();
  backgrounds.forEach((bg) => {
    if (bg.category) categories.add(bg.category);
  });
  return Array.from(categories).sort();
}

// Appends a cache-busting query param derived from the file's last-modified
// timestamp. The public URL for a given filename never changes even when
// its content does, so re-uploading a replacement under the same name (a
// fixed crop, say) leaves any cache — a CDN in front of Storage, or the
// app's own image cache, which keys purely on URL — with no signal that
// there's anything new to fetch. Folding updated_at into the URL means the
// URL itself changes whenever the file's content does, which is the only
// reliable way to invalidate those caches.
export function withCacheBust(url: string, updatedAt: string | null | undefined): string {
  if (!updatedAt) return url;
  return `${url}?v=${encodeURIComponent(updatedAt)}`;
}

// Storage's list() defaults to (and caps a single call at) 100 entries —
// undocumented in a way that's easy to miss until the bucket quietly
// grows past it. A bucket sorted alphabetically with more than 100 files
// silently drops everything after the 100th from a single call (observed:
// a "Water" category landing right at that boundary, with most of its
// photos cut off) rather than erroring, so this has to page through
// every batch itself instead of trusting one call to return everything.
const LIST_PAGE_SIZE = 100;

// Lists whatever photos currently exist in the quote-backgrounds Storage
// bucket. New photos dropped into the bucket via the Supabase dashboard
// show up here on next call — no app update needed, since the bucket is
// the source of truth, not a bundled/code-referenced list.
export async function listQuoteBackgrounds(): Promise<QuoteBackground[]> {
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
      category: deriveCategoryFromFilename(file.name),
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

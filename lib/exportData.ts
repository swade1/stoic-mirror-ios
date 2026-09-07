import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { supabase } from '@/lib/supabase';

interface EntryRow {
  id: string;
  concern: string;
  category: string;
  created_at: string;
}

interface EntryQuoteRow {
  entry_id: string;
  quote: string;
  author: string;
  source: string;
  interpretation: string | null;
}

interface SavedQuoteRow {
  quote: string;
  author: string;
  source: string;
  interpretation: string | null;
  concern: string | null;
  saved_at: string;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function buildMarkdown(
  concerns: string[],
  entries: EntryRow[],
  entryQuotesByEntry: Map<string, EntryQuoteRow[]>,
  savedQuotes: SavedQuoteRow[]
): string {
  const lines: string[] = [];

  lines.push('# The Stoic Mirror — Your Data Export');
  lines.push(`Exported on ${formatDate(new Date().toISOString())}`);
  lines.push('');

  lines.push('## Your Concerns');
  lines.push('');
  if (concerns.length) {
    for (const concern of concerns) lines.push(`- ${concern}`);
  } else {
    lines.push('_No concerns selected._');
  }
  lines.push('');

  lines.push('## Your Reflections');
  lines.push('');
  if (entries.length) {
    for (const entry of entries) {
      lines.push(`### ${formatDate(entry.created_at)} · ${entry.category}`);
      lines.push('');
      lines.push(`**You wrote:** "${entry.concern}"`);
      lines.push('');
      const quotes = entryQuotesByEntry.get(entry.id) ?? [];
      for (const q of quotes) {
        lines.push(`> "${q.quote}"`);
        lines.push(`> — ${q.author}, *${q.source}*`);
        lines.push('');
        if (q.interpretation) {
          lines.push(q.interpretation);
          lines.push('');
        }
      }
      lines.push('---');
      lines.push('');
    }
  } else {
    lines.push('_No reflections yet._');
    lines.push('');
  }

  lines.push('## Saved Quotes');
  lines.push('');
  if (savedQuotes.length) {
    for (const q of savedQuotes) {
      lines.push(`> "${q.quote}"`);
      lines.push(`> — ${q.author}, *${q.source}*`);
      lines.push('');
      if (q.interpretation) {
        lines.push(q.interpretation);
        lines.push('');
      }
      const meta = [`Saved ${formatDate(q.saved_at)}`];
      if (q.concern) meta.push(`originally about: "${q.concern}"`);
      lines.push(`_${meta.join(' · ')}_`);
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  } else {
    lines.push('_No saved quotes yet._');
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Gathers the signed-in user's concerns, reflections, and saved quotes,
 * writes them to a Markdown file, and opens the native share sheet.
 * Throws if there's no session or sharing isn't available on the device.
 */
export async function exportUserData(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not signed in');
  const userId = session.user.id;

  const [{ data: profile }, { data: entries }, { data: entryQuotes }, { data: savedQuotes }] =
    await Promise.all([
      supabase.from('profiles').select('concerns').eq('id', userId).single(),
      supabase
        .from('entries')
        .select('id, concern, category, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: true }),
      supabase
        .from('entry_quotes')
        .select('entry_id, quote, author, source, interpretation')
        .eq('user_id', userId),
      supabase
        .from('saved_quotes')
        .select('quote, author, source, interpretation, concern, saved_at')
        .eq('user_id', userId)
        .order('saved_at', { ascending: true }),
    ]);

  const entryQuotesByEntry = new Map<string, EntryQuoteRow[]>();
  for (const q of (entryQuotes ?? []) as EntryQuoteRow[]) {
    const list = entryQuotesByEntry.get(q.entry_id) ?? [];
    list.push(q);
    entryQuotesByEntry.set(q.entry_id, list);
  }

  const markdown = buildMarkdown(
    profile?.concerns ?? [],
    (entries ?? []) as EntryRow[],
    entryQuotesByEntry,
    (savedQuotes ?? []) as SavedQuoteRow[]
  );

  const file = new File(Paths.cache, 'stoic-mirror-export.md');
  file.create({ overwrite: true });
  file.write(markdown);

  const isAvailable = await Sharing.isAvailableAsync();
  if (!isAvailable) throw new Error('Sharing is not available on this device');

  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/markdown',
    UTI: 'net.daringfireball.markdown',
    dialogTitle: 'Export Your Data',
  });
}

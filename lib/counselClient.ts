import { supabase } from '@/lib/supabase';

export interface CounselQuote {
  quote: string;
  author: string;
  source: string;
  interpretation: string;
  passage_id: string | null;
  matched_concern: string | null;
}

export interface CounselResult {
  quotes: CounselQuote[];
  category: string;
}

// Thrown message the loading screen matches on to show the "You've Read the
// Entire Stoa" alert.
export const NO_PASSAGES_MESSAGE = 'No relevant passages found';

/** Turns an error body from the seek-counsel function into a user-facing Error. */
export function counselErrorFromBody(body: { error?: string; reason?: string } | null): Error {
  switch (body?.error) {
    case 'no_passages':
      return new Error(NO_PASSAGES_MESSAGE);
    case 'rate_limited':
      return new Error(
        body.reason === 'burst'
          ? 'You\'re going a little fast. Please wait a minute and try again.'
          : "You've reached today's limit of reflections. Please try again tomorrow."
      );
    case 'invalid_request':
      return new Error('Please shorten your concern and try again.');
    default:
      return new Error('Something went wrong seeking counsel. Please try again.');
  }
}

/** Asks the seek-counsel Edge Function for counsel. API keys live only on the server. */
export async function requestCounsel(concern: string): Promise<CounselResult> {
  const { data, error } = await supabase.functions.invoke('seek-counsel', {
    body: { concern },
  });

  if (error) {
    // FunctionsHttpError carries the Response with our JSON error body;
    // FunctionsFetchError means the request never reached the server.
    const response = (error as { context?: unknown }).context;
    if (response instanceof Response) {
      const body = await response.json().catch(() => null);
      throw counselErrorFromBody(body);
    }
    throw new Error('Network request failed');
  }

  return data as CounselResult;
}

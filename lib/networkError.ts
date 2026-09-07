/**
 * True when `fetch` never reached the network at all (no connection,
 * airplane mode, DNS failure, etc.) — distinct from a request that
 * completed but returned a non-ok HTTP status, which is a real API
 * failure and should keep showing its own specific message.
 */
export function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return /network request failed|failed to fetch|network error/i.test(error.message);
}

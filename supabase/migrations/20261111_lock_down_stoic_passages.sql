-- Passages are now read only by the seek-counsel Edge Function (service role,
-- which bypasses RLS). Turning RLS on with no policies hides the table from
-- the public anon key, and the search function is no longer callable by app
-- users directly.
alter table public.stoic_passages enable row level security;

revoke execute on function public.match_stoic_passages(vector, integer, double precision, uuid[], text[])
  from public, anon, authenticated;

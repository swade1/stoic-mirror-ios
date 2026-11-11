-- Server-side record of counsel requests, written only by the seek-counsel
-- Edge Function (service role). Drives the per-minute and per-day limits that
-- used to be checked, bypassably, on the phone. Stores no concern text.
create table public.counsel_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index counsel_requests_user_created_idx
  on public.counsel_requests (user_id, created_at desc);

-- RLS on with no policies: invisible and unwritable to app users; the service
-- role bypasses RLS.
alter table public.counsel_requests enable row level security;

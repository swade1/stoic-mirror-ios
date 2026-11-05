drop function if exists public.subscribe_email(text);

-- Returns the token and whether this call newly (re)activated the subscription.
-- Callable only by the service role (the subscribe Edge Function), never by anon.
create function public.subscribe_email(p_email text)
returns table (unsubscribe_token uuid, is_new boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_token uuid;
begin
  if v_email is null or char_length(v_email) > 254
     or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;

  insert into public.email_subscribers as s (email) values (v_email)
  on conflict (email) do update
    set unsubscribed_at = null, subscribed_at = now()
    where s.unsubscribed_at is not null
  returning s.unsubscribe_token into v_token;

  if v_token is not null then
    return query select v_token, true;
  else
    return query select s.unsubscribe_token, false
      from public.email_subscribers s where s.email = v_email;
  end if;
end;
$$;

create or replace function public.unsubscribe_by_email(p_email text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.email_subscribers
     set unsubscribed_at = coalesce(unsubscribed_at, now())
   where email = lower(btrim(p_email));
$$;

revoke all on function public.subscribe_email(text) from public, anon, authenticated;
grant execute on function public.subscribe_email(text) to service_role;
revoke all on function public.unsubscribe_by_email(text) from public;
grant execute on function public.unsubscribe_by_email(text) to anon, authenticated;

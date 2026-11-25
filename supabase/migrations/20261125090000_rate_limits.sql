-- P4-08 · D86: rate limits in Postgres, with fixed windows and no new service.
-- Keys are HMACs computed by the app (server/rate-limit.ts), so no email or IP address is stored (AGENTS §12).
-- Old windows are purged by the nightly job (P4-11, D94).

create table public.rate_limits (
  key text not null check (char_length(key) between 1 and 200),
  window_start timestamptz not null,
  hits integer not null check (hits > 0),
  primary key (key, window_start)
);

-- RLS on, and no policies: the API roles reach the table only through hit_rate_limit (AGENTS §6).
alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from anon, authenticated, public;

comment on table public.rate_limits is
  'D86: hit counts per key and fixed window. Reached only through hit_rate_limit(); keys are HMACs.';

-- Counts one hit for `p_key` in the current window of `p_window_s` seconds and returns true while the count is
-- within `p_max`. The upsert is atomic, so concurrent hits are all counted.
create function public.hit_rate_limit(p_key text, p_max integer, p_window_s integer)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_hits integer;
begin
  if p_key is null or char_length(p_key) not between 1 and 200 then
    raise exception 'hit_rate_limit: invalid key' using errcode = '22023';
  end if;
  if p_max is null or p_max not between 1 and 10000 then
    raise exception 'hit_rate_limit: invalid max' using errcode = '22023';
  end if;
  if p_window_s is null or p_window_s not between 1 and 86400 then
    raise exception 'hit_rate_limit: invalid window' using errcode = '22023';
  end if;

  v_window_start := to_timestamp(floor(extract(epoch from now()) / p_window_s) * p_window_s);

  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, v_window_start, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  return v_hits <= p_max;
end;
$$;

-- Auth requests are anonymous, so anon calls it too; the HMAC keeps callers from hitting a real key.
revoke all on function public.hit_rate_limit(text, integer, integer) from public;
grant execute on function public.hit_rate_limit(text, integer, integer) to anon, authenticated;

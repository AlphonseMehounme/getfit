-- P4-04 · The sync endpoint's two tables (PRD §12, D89, D91, D103). RLS is enabled here, owner-only (AGENTS §6).
-- Both are purged after 30 days by the nightly job (P4-11, D94).

-- The ledger: one row per outbox write the server has seen, keyed by the write's device ID, so a resent write is
-- answered `duplicate` and never applied twice. A row is claimed as `pending` before the write is applied and
-- settled afterwards; a `pending` row left by a failed attempt is applied again on the retry.
create table public.sync_writes (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null check (char_length(kind) between 1 and 32),
  status text not null check (status in ('pending', 'applied', 'conflict', 'refused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sync_writes_user_created_idx on public.sync_writes (user_id, created_at);

create trigger sync_writes_set_updated_at
  before update on public.sync_writes
  for each row execute function public.set_updated_at();

alter table public.sync_writes enable row level security;

create policy sync_writes_select_own on public.sync_writes
  for select to authenticated using (user_id = (select auth.uid()));
create policy sync_writes_insert_own on public.sync_writes
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy sync_writes_update_own on public.sync_writes
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on table public.sync_writes from anon, authenticated, public;
grant select, insert, update on table public.sync_writes to authenticated;

-- D91 / D103: every write the server did not apply, a conflict's losing version or a refused write, with its payload,
-- so nothing the user logged is lost. Written once, never edited.
create table public.sync_conflicts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  write_id uuid not null,
  kind text not null check (char_length(kind) between 1 and 32),
  status text not null check (status in ('conflict', 'refused')),
  reason text check (char_length(reason) <= 64),
  record_type text check (record_type in ('workout_session', 'workout_set', 'running_session')),
  record_id uuid,
  payload jsonb,
  client_updated_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index sync_conflicts_user_created_idx on public.sync_conflicts (user_id, created_at);

alter table public.sync_conflicts enable row level security;

create policy sync_conflicts_select_own on public.sync_conflicts
  for select to authenticated using (user_id = (select auth.uid()));
create policy sync_conflicts_insert_own on public.sync_conflicts
  for insert to authenticated with check (user_id = (select auth.uid()));

revoke all on table public.sync_conflicts from anon, authenticated, public;
grant select, insert on table public.sync_conflicts to authenticated;

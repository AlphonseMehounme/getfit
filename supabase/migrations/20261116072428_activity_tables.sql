-- P1-03b · Activity user tables: logged history (PRD §11, "User tables (RLS: owner only)").
-- RLS is enabled in this same migration, with owner-only policies (AGENTS §6, PRD §12).
--
-- Conventions for every table here:
-- - IDs are generated on the device and writes are upserts by ID, so retries are idempotent (AGENTS §6, D21).
--   There is deliberately no default on `id`.
-- - Timestamps are timestamptz (UTC); `scheduled_date` / `local_date` are computed in the user's time zone at write time.
-- - Units are metres, seconds and kilograms (BR-20). Pace, speed, age and missed status are never stored (BR-22, D6).
-- - History is immutable (BR-25): users get no DELETE privilege. Removal is a soft delete (`deleted_at`);
--   rows go only with the account (cascade from profiles) or the purge job.
-- - `client_updated_at` is the device's edit time, used by the Phase 4 sync to resolve conflicts (PRD §12).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

-- PRD §5.2. `missed`, `scheduled` and `rest` are derived by the engine at read time and never stored (BR-7, D6).
create type public.workout_status as enum ('in_progress', 'partial', 'completed', 'abandoned');
create type public.set_side as enum ('left', 'right', 'both'); -- BR-16
create type public.run_source as enum ('manual', 'gps', 'import'); -- PRD §3 extensibility hook
create type public.fitness_test_type as enum ('max_pull_ups', 'max_push_ups', 'max_squats');

-- Lets a logged session name the enrolment it belongs to *and* its owner in one foreign key, so a row can
-- never link to someone else's enrolment (which would also let it take their fulfilment slot, D26).
alter table public.user_programmes add constraint user_programmes_id_user_key unique (id, user_id);

-- ---------------------------------------------------------------------------
-- workout_sessions
-- ---------------------------------------------------------------------------

create table public.workout_sessions (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Programme links; all null for an ad-hoc session.
  user_programme_id uuid,
  programme_day_id uuid references public.programme_days (id) on delete restrict,
  scheduled_date date,
  session_template_id uuid references public.session_templates (id) on delete restrict,
  -- BR-25: the prescription the session was logged against; never changed afterwards (trigger below).
  prescription_snapshot jsonb
    constraint workout_sessions_snapshot_object
      check (prescription_snapshot is null or jsonb_typeof(prescription_snapshot) = 'object'),
  status public.workout_status not null default 'in_progress',
  started_at timestamptz not null,
  -- When the user saved the session, as completed (BR-5) or partial (BR-6).
  completed_at timestamptz,
  paused_s integer not null default 0 check (paused_s >= 0),
  duration_s integer check (duration_s >= 0),
  rpe smallint check (rpe between 1 and 10),
  notes text,
  client_updated_at timestamptz not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- NO ACTION, not RESTRICT: account deletion cascades to both tables in one statement, and NO ACTION checks
  -- at the end of it. Deleting an enrolment that still has history fails (BR-25).
  foreign key (user_programme_id, user_id) references public.user_programmes (id, user_id),
  constraint workout_sessions_programme_link
    check (num_nonnulls(user_programme_id, programme_day_id, scheduled_date) in (0, 3)),
  constraint workout_sessions_programme_snapshot
    check (programme_day_id is null or prescription_snapshot is not null),
  constraint workout_sessions_saved_when_finished
    check ((status in ('partial', 'completed')) = (completed_at is not null)),
  constraint workout_sessions_completed_after_start check (completed_at >= started_at)
);

-- D26 / PRD §11 "One fulfilment": one partial or completed, non-deleted session per programme day.
create unique index workout_sessions_one_fulfilment
  on public.workout_sessions (user_programme_id, programme_day_id)
  where status in ('partial', 'completed') and deleted_at is null;

create index workout_sessions_user_scheduled_idx on public.workout_sessions (user_id, scheduled_date);
create index workout_sessions_user_started_idx on public.workout_sessions (user_id, started_at desc);
create index workout_sessions_user_programme_idx on public.workout_sessions (user_programme_id, user_id);
create index workout_sessions_programme_day_idx on public.workout_sessions (programme_day_id);
create index workout_sessions_session_template_idx on public.workout_sessions (session_template_id);

create function public.freeze_prescription_snapshot() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.prescription_snapshot is distinct from old.prescription_snapshot then
    raise exception 'prescription_snapshot is immutable (BR-25)'
      using errcode = '23514', constraint = 'workout_sessions_snapshot_immutable';
  end if;
  return new;
end;
$$;

create trigger workout_sessions_freeze_snapshot
  before update of prescription_snapshot on public.workout_sessions
  for each row execute function public.freeze_prescription_snapshot();

create trigger workout_sessions_set_updated_at
  before update on public.workout_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- workout_sets: owned through their session
-- ---------------------------------------------------------------------------

create table public.workout_sets (
  id uuid primary key,
  workout_session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  substituted_for_exercise_id uuid references public.exercises (id) on delete restrict,
  set_number integer not null check (set_number >= 1),
  side public.set_side not null default 'both',
  actual_reps integer check (actual_reps >= 0),
  actual_duration_s integer check (actual_duration_s >= 0),
  load_kg numeric(6, 2) check (load_kg >= 0),
  rir smallint check (rir between 0 and 10),
  completed boolean not null default true,
  logged_at timestamptz not null,
  client_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (workout_session_id, exercise_id, set_number, side),
  constraint workout_sets_one_measure check (num_nonnulls(actual_reps, actual_duration_s) <= 1),
  constraint workout_sets_substitute_differs check (substituted_for_exercise_id <> exercise_id)
);

create index workout_sets_exercise_idx on public.workout_sets (exercise_id);
create index workout_sets_substituted_for_idx on public.workout_sets (substituted_for_exercise_id);

create trigger workout_sets_set_updated_at
  before update on public.workout_sets
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- running_sessions (BR-20 to BR-22)
-- ---------------------------------------------------------------------------

create table public.running_sessions (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_programme_id uuid,
  programme_day_id uuid references public.programme_days (id) on delete restrict,
  scheduled_date date,
  started_at timestamptz not null,
  local_date date not null,
  -- BR-20 / BR-21: whole metres and seconds, both positive. Pace and speed are computed (BR-22).
  distance_m integer not null constraint running_sessions_distance_positive check (distance_m > 0),
  duration_s integer not null constraint running_sessions_duration_positive check (duration_s > 0),
  rpe smallint check (rpe between 1 and 10),
  route_name text,
  notes text,
  source public.run_source not null default 'manual',
  -- BR-26: a baseline is a reference value, never a session that fulfils the programme.
  is_baseline boolean not null default false,
  client_updated_at timestamptz not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_programme_id, user_id) references public.user_programmes (id, user_id),
  constraint running_sessions_programme_link
    check (num_nonnulls(user_programme_id, programme_day_id, scheduled_date) in (0, 3)),
  constraint running_sessions_baseline_unlinked check (not is_baseline or programme_day_id is null)
);

-- D26: a logged run is always complete, so any non-deleted linked run fulfils its day.
create unique index running_sessions_one_fulfilment
  on public.running_sessions (user_programme_id, programme_day_id)
  where deleted_at is null;

create index running_sessions_user_local_date_idx on public.running_sessions (user_id, local_date);
create index running_sessions_user_started_idx on public.running_sessions (user_id, started_at desc);
create index running_sessions_user_programme_idx on public.running_sessions (user_programme_id, user_id);
create index running_sessions_programme_day_idx on public.running_sessions (programme_day_id);

create trigger running_sessions_set_updated_at
  before update on public.running_sessions
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Measurements and tests (BR-26 baselines, week-8 re-tests)
-- ---------------------------------------------------------------------------

-- The single source of weight (PRD §11); current weight is never stored on the profile.
create table public.body_measurements (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  measured_at timestamptz not null,
  weight_kg numeric(5, 2) check (weight_kg > 0 and weight_kg < 500),
  body_fat_pct numeric(4, 1) check (body_fat_pct > 0 and body_fat_pct < 100),
  is_baseline boolean not null default false,
  notes text,
  client_updated_at timestamptz not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint body_measurements_has_value check (num_nonnulls(weight_kg, body_fat_pct) >= 1)
);

create index body_measurements_user_measured_idx on public.body_measurements (user_id, measured_at desc);

create table public.fitness_tests (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  tested_at timestamptz not null,
  test_type public.fitness_test_type not null,
  value integer not null check (value >= 0),
  is_baseline boolean not null default false,
  client_updated_at timestamptz not null,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);

create index fitness_tests_user_tested_idx on public.fitness_tests (user_id, tested_at desc);

-- ---------------------------------------------------------------------------
-- weekly_reviews (PRD §6.9)
-- ---------------------------------------------------------------------------

create table public.weekly_reviews (
  id uuid primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  user_programme_id uuid,
  -- D5: weeks start on Monday.
  week_start date not null
    constraint weekly_reviews_week_start_monday check (extract(isodow from week_start) = 1),
  fatigue smallint check (fatigue between 1 and 5),
  soreness smallint check (soreness between 1 and 5),
  sleep_quality smallint check (sleep_quality between 1 and 5),
  motivation smallint check (motivation between 1 and 5),
  -- BR-27: pain details exist only when pain is reported.
  pain boolean not null default false,
  pain_location text,
  pain_notes text,
  recommendation_key text,
  notes text,
  client_updated_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start),
  foreign key (user_programme_id, user_id) references public.user_programmes (id, user_id),
  constraint weekly_reviews_pain_details
    check (pain or (pain_location is null and pain_notes is null))
);

create index weekly_reviews_user_programme_idx on public.weekly_reviews (user_programme_id, user_id);

create trigger weekly_reviews_set_updated_at
  before update on public.weekly_reviews
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Access: owner only (PRD §12); select, insert and update, never delete (BR-25).
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'workout_sessions', 'workout_sets', 'running_sessions',
    'body_measurements', 'fitness_tests', 'weekly_reviews'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on table public.%I to authenticated', t);
  end loop;
end
$$;

-- Tables owned directly through user_id.
do $$
declare
  t text;
begin
  foreach t in array array[
    'workout_sessions', 'running_sessions', 'body_measurements', 'fitness_tests', 'weekly_reviews'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (user_id = (select auth.uid()))',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated '
      'using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      t || '_update_own', t);
  end loop;
end
$$;

-- workout_sets, owned through their session.
create function public.owns_workout_session(target uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workout_sessions ws
    where ws.id = target and ws.user_id = (select auth.uid())
  );
$$;

revoke execute on function public.owns_workout_session(uuid) from public, anon;
grant execute on function public.owns_workout_session(uuid) to authenticated;

create policy workout_sets_select_own on public.workout_sets
  for select to authenticated using (public.owns_workout_session(workout_session_id));
create policy workout_sets_insert_own on public.workout_sets
  for insert to authenticated with check (public.owns_workout_session(workout_session_id));
create policy workout_sets_update_own on public.workout_sets
  for update to authenticated
  using (public.owns_workout_session(workout_session_id))
  with check (public.owns_workout_session(workout_session_id));

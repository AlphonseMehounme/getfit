-- P1-03a · Profile and enrolment user tables (PRD §11, "User tables (RLS: owner only)").
-- RLS is enabled in this same migration, with owner-only policies (AGENTS §6, PRD §12).
-- Every user table cascades from profiles, which cascades from auth.users (PRD §11 "History").

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.unit_system as enum ('metric', 'imperial');
create type public.experience_level as enum ('beginner', 'intermediate', 'advanced'); -- PRD §6.2 step 3
create type public.goal_type as enum (
  'build_muscle', 'increase_strength', 'improve_endurance', 'improve_running', 'general_fitness', 'maintain'
); -- PRD §6.2 step 2
create type public.goal_status as enum ('active', 'achieved', 'abandoned');
create type public.availability_kind as enum ('training', 'running', 'rest'); -- PRD §6.2 step 5
create type public.start_mode as enum ('next_monday', 'this_week'); -- BR-2
create type public.enrolment_status as enum ('active', 'completed', 'abandoned');
create type public.override_action as enum ('moved', 'skipped');

-- ---------------------------------------------------------------------------
-- Shared trigger functions
-- ---------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Time zones must be IANA names Postgres knows, because the schedule is computed in them (BR-1, BR-4).
create function public.is_known_time_zone(tz text) returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

create function public.validate_profile_time_zone() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not public.is_known_time_zone(new.timezone) then
    raise exception 'unknown time zone: %', new.timezone
      using errcode = '23514', constraint = 'profiles_timezone_known';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user, no separate users table, no stored age or weight (PRD §11)
-- ---------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  -- Required by onboarding step 1 (Phase 2); empty until then (D29).
  first_name text check (first_name is null or btrim(first_name) <> ''),
  birth_year integer check (birth_year between 1900 and 2100),
  height_cm numeric(4, 1) check (height_cm > 0 and height_cm < 300),
  preferred_units public.unit_system not null default 'metric',
  locale public.app_locale not null default 'fr',
  timezone text not null default 'UTC',
  experience_level public.experience_level,
  preferred_duration_min integer check (preferred_duration_min > 0),
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_validate_time_zone
  before insert or update of timezone on public.profiles
  for each row execute function public.validate_profile_time_zone();

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- D29: a minimal profile is created at sign-up from the browser's locale and time zone.
-- Unknown or missing values fall back to French (D15) and UTC, so sign-up never fails on metadata.
create function public.handle_new_user() returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_locale text := new.raw_user_meta_data ->> 'locale';
  requested_tz text := new.raw_user_meta_data ->> 'timezone';
begin
  insert into public.profiles (id, locale, timezone)
  values (
    new.id,
    case when requested_locale in ('fr', 'en') then requested_locale::public.app_locale else 'fr' end,
    case when public.is_known_time_zone(requested_tz) then requested_tz else 'UTC' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- The trigger function is not callable through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Goals, equipment, availability (onboarding, PRD §6.2)
-- ---------------------------------------------------------------------------

create table public.user_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  goal_type public.goal_type not null,
  target_value numeric check (target_value > 0),
  target_unit text,
  target_date date,
  status public.goal_status not null default 'active',
  created_at timestamptz not null default now()
);

create index user_goals_user_idx on public.user_goals (user_id);
create unique index user_goals_one_active_per_type on public.user_goals (user_id, goal_type)
  where status = 'active';

create table public.user_equipment (
  user_id uuid not null references public.profiles (id) on delete cascade,
  equipment public.equipment_type not null,
  primary key (user_id, equipment)
);

create table public.user_availability (
  user_id uuid not null references public.profiles (id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 1 and 7), -- D5: 1 = Monday
  kind public.availability_kind not null,
  primary key (user_id, day_of_week)
);

-- ---------------------------------------------------------------------------
-- Enrolment (PRD §11; BR-2, BR-25)
-- ---------------------------------------------------------------------------

-- Lets an enrolment reference the exact programme version it was made against.
alter table public.programmes add constraint programmes_id_version_key unique (id, version);

create table public.user_programmes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  programme_id uuid not null,
  programme_version integer not null,
  -- BR-2 / BR-3: the Monday of programme week 1, in the user's time zone.
  start_date date not null
    constraint user_programmes_start_on_monday check (extract(isodow from start_date) = 1),
  start_mode public.start_mode not null,
  status public.enrolment_status not null default 'active',
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (programme_id, programme_version)
    references public.programmes (id, version) on delete restrict,
  constraint user_programmes_ended_when_not_active check ((status = 'active') = (ended_at is null))
);

create unique index user_programmes_one_active on public.user_programmes (user_id) where status = 'active';
create index user_programmes_user_idx on public.user_programmes (user_id);
create index user_programmes_programme_idx on public.user_programmes (programme_id, programme_version);

create trigger user_programmes_set_updated_at
  before update on public.user_programmes
  for each row execute function public.set_updated_at();

create table public.schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  user_programme_id uuid not null references public.user_programmes (id) on delete cascade,
  programme_day_id uuid not null references public.programme_days (id) on delete restrict,
  original_date date not null,
  new_date date,
  action public.override_action not null,
  reason text,
  created_at timestamptz not null default now(),
  unique (user_programme_id, programme_day_id),
  constraint schedule_overrides_moved_has_date check ((action = 'moved') = (new_date is not null)),
  constraint schedule_overrides_moves_somewhere check (new_date is distinct from original_date),
  -- BR-12 / D10, last line of defence: a move stays in its Monday–Sunday week. The rule itself is in the domain.
  constraint schedule_overrides_same_week
    check (new_date is null or date_trunc('week', new_date) = date_trunc('week', original_date))
);

create index schedule_overrides_programme_day_idx on public.schedule_overrides (programme_day_id);

-- BR-19: accepted progression suggestions. The programme template is never edited.
create table public.prescription_overrides (
  id uuid primary key default gen_random_uuid(),
  user_programme_id uuid not null references public.user_programmes (id) on delete cascade,
  template_exercise_id uuid not null references public.template_exercises (id) on delete restrict,
  from_week integer not null check (from_week >= 1),
  target_reps integer check (target_reps >= 1),
  target_duration_s integer check (target_duration_s >= 1),
  target_distance_m integer check (target_distance_m >= 1),
  accepted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (user_programme_id, template_exercise_id, from_week),
  constraint prescription_overrides_exactly_one_target
    check (num_nonnulls(target_reps, target_duration_s, target_distance_m) = 1)
);

create index prescription_overrides_template_exercise_idx
  on public.prescription_overrides (template_exercise_id);

-- ---------------------------------------------------------------------------
-- Access: owner only (PRD §12). Anonymous visitors get no privileges at all.
-- `(select auth.uid())` is evaluated once per statement rather than once per row.
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'user_goals', 'user_equipment', 'user_availability',
    'user_programmes', 'schedule_overrides', 'prescription_overrides'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
  end loop;
end
$$;

-- profiles: created by the sign-up trigger, removed only with the auth user (account deletion).
grant select, update on table public.profiles to authenticated;
create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Tables owned directly through user_id.
do $$
declare
  t text;
begin
  foreach t in array array['user_goals', 'user_equipment', 'user_availability', 'user_programmes'] loop
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
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
    execute format(
      'create policy %I on public.%I for delete to authenticated using (user_id = (select auth.uid()))',
      t || '_delete_own', t);
  end loop;
end
$$;

-- Tables owned through their enrolment.
create function public.owns_user_programme(target uuid) returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_programmes up
    where up.id = target and up.user_id = (select auth.uid())
  );
$$;

revoke execute on function public.owns_user_programme(uuid) from public, anon;
grant execute on function public.owns_user_programme(uuid) to authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['schedule_overrides', 'prescription_overrides'] loop
    execute format('grant select, insert, update, delete on table public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.owns_user_programme(user_programme_id))',
      t || '_select_own', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.owns_user_programme(user_programme_id))',
      t || '_insert_own', t);
    execute format(
      'create policy %I on public.%I for update to authenticated '
      'using (public.owns_user_programme(user_programme_id)) with check (public.owns_user_programme(user_programme_id))',
      t || '_update_own', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.owns_user_programme(user_programme_id))',
      t || '_delete_own', t);
  end loop;
end
$$;

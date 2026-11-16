-- P1-02 · Content tables (PRD §11, "Content tables (seeded, read-only to users)").
-- Shared programme and exercise content, loaded from content/ by the seed (AGENTS §5.6).
-- Users can read everything here and write nothing. Never edit this file once applied (AGENTS §6).

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type public.app_locale as enum ('fr', 'en'); -- D15
create type public.exercise_category as enum ('upper', 'lower', 'core', 'recovery', 'mobility', 'running'); -- D28
create type public.exercise_pattern as enum ('pull', 'push'); -- D28
create type public.difficulty_level as enum ('beginner', 'intermediate', 'advanced');
create type public.equipment_type as enum ('bodyweight', 'pull_up_bar', 'dumbbells', 'barbell', 'bands', 'gym', 'other'); -- PRD §6.2
create type public.exercise_relation_kind as enum ('variation', 'substitute');
create type public.session_type as enum ('strength', 'run', 'recovery', 'rest');
create type public.body_focus as enum ('upper', 'lower', 'full', 'none');

-- ---------------------------------------------------------------------------
-- Exercises
-- ---------------------------------------------------------------------------

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique
    constraint exercises_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  category public.exercise_category not null,
  pattern public.exercise_pattern,
  difficulty public.difficulty_level not null,
  equipment public.equipment_type[] not null default '{}',
  muscle_groups text[] not null default '{}',
  is_unilateral boolean not null default false,
  -- AGENTS §8: media is resolved only by slug, so the media key can never point elsewhere.
  media_key text not null
    constraint exercises_media_key_is_slug check (media_key = slug),
  -- Referenced exercises are never hard-deleted; unpublish instead (PRD §11).
  published boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table public.exercises is 'Exercise library (PRD §8). Never hard-delete once referenced; unpublish.';

create table public.exercise_translations (
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  locale public.app_locale not null,
  name text not null check (btrim(name) <> ''),
  alt_names text[] not null default '{}',
  description text not null,
  instructions jsonb not null default '[]'
    constraint exercise_translations_instructions_array check (jsonb_typeof(instructions) = 'array'),
  common_mistakes jsonb not null default '[]'
    constraint exercise_translations_mistakes_array check (jsonb_typeof(common_mistakes) = 'array'),
  media_alt text not null check (btrim(media_alt) <> ''),
  primary key (exercise_id, locale)
);

create table public.exercise_relations (
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  related_exercise_id uuid not null references public.exercises (id) on delete restrict,
  kind public.exercise_relation_kind not null,
  primary key (exercise_id, related_exercise_id, kind),
  constraint exercise_relations_not_self check (exercise_id <> related_exercise_id)
);

create index exercise_relations_related_idx on public.exercise_relations (related_exercise_id);

-- ---------------------------------------------------------------------------
-- Programmes
-- ---------------------------------------------------------------------------

create table public.programmes (
  id uuid primary key default gen_random_uuid(),
  slug text not null
    constraint programmes_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  -- New content = new version; enrolments keep theirs (PRD §11).
  version integer not null check (version >= 1),
  duration_weeks integer not null check (duration_weeks >= 1),
  difficulty public.difficulty_level not null,
  objectives text[] not null default '{}',
  required_equipment public.equipment_type[] not null default '{}',
  published boolean not null default true,
  created_at timestamptz not null default now(),
  unique (slug, version)
);

create table public.programme_translations (
  programme_id uuid not null references public.programmes (id) on delete restrict,
  locale public.app_locale not null,
  title text not null check (btrim(title) <> ''),
  description text not null,
  safety_notes jsonb not null default '[]'
    constraint programme_translations_safety_notes_array check (jsonb_typeof(safety_notes) = 'array'),
  primary key (programme_id, locale)
);

create table public.programme_weeks (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes (id) on delete restrict,
  week_number integer not null check (week_number >= 1),
  focus_key text not null,
  -- BR-17 / D11: 1.0 normally, 0.65 in the deload week.
  volume_multiplier numeric(4, 3) not null check (volume_multiplier > 0),
  -- BR-15 / D25: authoritative long-run ceiling for the week, in metres; null if the programme has no run.
  long_run_ceiling_m integer check (long_run_ceiling_m > 0),
  unique (programme_id, week_number)
);

-- ADR 0004: localised week label and focus text (PRD §11 has no home for them).
create table public.programme_week_translations (
  programme_week_id uuid not null references public.programme_weeks (id) on delete restrict,
  locale public.app_locale not null,
  label text not null check (btrim(label) <> ''),
  focus text not null,
  primary key (programme_week_id, locale)
);

create table public.session_templates (
  id uuid primary key default gen_random_uuid(),
  programme_id uuid not null references public.programmes (id) on delete restrict,
  slug text not null
    constraint session_templates_slug_format check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  session_type public.session_type not null,
  body_focus public.body_focus not null,
  estimated_duration_min integer check (estimated_duration_min > 0),
  counts_for_adherence boolean not null,
  unique (programme_id, slug),
  -- BR-8: only strength sessions and the long run count for adherence.
  constraint session_templates_adherence_types
    check (not counts_for_adherence or session_type in ('strength', 'run'))
);

-- ADR 0004: localised session title, purpose and day guidance (PRD §6.3, §6.4).
create table public.session_template_translations (
  session_template_id uuid not null references public.session_templates (id) on delete restrict,
  locale public.app_locale not null,
  title text not null check (btrim(title) <> ''),
  purpose text not null,
  guidance jsonb not null default '[]'
    constraint session_template_translations_guidance_array check (jsonb_typeof(guidance) = 'array'),
  primary key (session_template_id, locale)
);

create table public.programme_days (
  id uuid primary key default gen_random_uuid(),
  programme_week_id uuid not null references public.programme_weeks (id) on delete restrict,
  -- BR-3 / D5: 1 = Monday … 7 = Sunday.
  day_of_week smallint not null check (day_of_week between 1 and 7),
  -- Templates are reused across weeks, not copied (PRD §11).
  session_template_id uuid not null references public.session_templates (id) on delete restrict,
  unique (programme_week_id, day_of_week)
);

create index programme_days_session_template_idx on public.programme_days (session_template_id);

create table public.template_exercises (
  id uuid primary key default gen_random_uuid(),
  session_template_id uuid not null references public.session_templates (id) on delete restrict,
  exercise_id uuid not null references public.exercises (id) on delete restrict,
  sequence integer not null check (sequence >= 1),
  target_sets integer not null check (target_sets >= 1),
  -- BR-14 / D1: one single target, the upper bound of the original range.
  target_reps integer check (target_reps >= 1),
  target_duration_s integer check (target_duration_s >= 1),
  target_distance_m integer check (target_distance_m >= 1),
  -- BR-16: the target applies to each side.
  per_side boolean not null default false,
  rest_s integer check (rest_s >= 0),
  note_key text,
  unique (session_template_id, sequence),
  constraint template_exercises_exactly_one_target
    check (num_nonnulls(target_reps, target_duration_s, target_distance_m) = 1)
);

create index template_exercises_exercise_idx on public.template_exercises (exercise_id);

-- ---------------------------------------------------------------------------
-- Access: RLS on, read-only for signed-in users, nothing for anonymous visitors (PRD §12).
-- Grants are revoked as well, so writes fail loudly instead of silently matching no rows.
-- Policies don't depend on roles beyond `authenticated` (PRD §3 extensibility hooks).
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'exercises', 'exercise_translations', 'exercise_relations',
    'programmes', 'programme_translations', 'programme_weeks', 'programme_week_translations',
    'session_templates', 'session_template_translations', 'programme_days', 'template_exercises'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from anon, authenticated', t);
    execute format('grant select on table public.%I to authenticated', t);
    execute format(
      'create policy %I on public.%I for select to authenticated using (true)',
      t || '_select_authenticated', t
    );
  end loop;
end
$$;

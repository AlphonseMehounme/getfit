import { LOCALES } from '../../content/schema/exercise.ts';
import { WEEKDAYS, type Programme } from '../../content/schema/programme.ts';
import { array, bool, jsonb, literal, num } from './sql.ts';

// ADR 0005: programme content as idempotent upserts on natural keys. Rows are never deleted: once a
// version is in use, changing its content means publishing a new version (PRD §11).

const rows = (lines: string[]) => lines.map((line) => `  ${line}`).join(',\n');
const tuple = (values: string[]) => `(${values.join(', ')})`;

/** `insert … select … from (values …) join …`, the shape every child table uses. */
function upsertFrom(spec: {
  table: string;
  columns: string[];
  select: string[];
  alias: string[];
  values: string[][];
  joins: string[];
  conflict: string[];
}): string {
  const keys = new Set(spec.conflict);
  const updates = spec.columns.filter((c) => !keys.has(c)).map((c) => `  ${c} = excluded.${c}`);
  return [
    `insert into public.${spec.table} (${spec.columns.join(', ')})`,
    `select ${spec.select.join(', ')}`,
    'from (values',
    rows(spec.values.map(tuple)),
    `) as v (${spec.alias.join(', ')})`,
    ...spec.joins,
    `on conflict (${spec.conflict.join(', ')}) do update set`,
    `${updates.join(',\n')};`,
  ].join('\n');
}

const JOIN_PROGRAMME = 'join public.programmes p on p.slug = v.slug and p.version = v.version';

export function programmeSql(programme: Programme): string {
  const key = [literal(programme.slug), num(programme.version, 'integer')];
  const sql: string[] = [];

  sql.push(
    [
      'insert into public.programmes',
      '  (slug, version, duration_weeks, difficulty, objectives, required_equipment)',
      'values',
      `  ${tuple([
        ...key,
        num(programme.durationWeeks, 'integer'),
        `${literal(programme.difficulty)}::public.difficulty_level`,
        array(programme.objectives, 'text'),
        array(programme.requiredEquipment, 'public.equipment_type'),
      ])}`,
      'on conflict (slug, version) do update set',
      '  duration_weeks = excluded.duration_weeks,',
      '  difficulty = excluded.difficulty,',
      '  objectives = excluded.objectives,',
      '  required_equipment = excluded.required_equipment;',
    ].join('\n'),
  );

  sql.push(
    upsertFrom({
      table: 'programme_translations',
      columns: ['programme_id', 'locale', 'title', 'description', 'safety_notes'],
      select: ['p.id', 'v.locale', 'v.title', 'v.description', 'v.safety_notes'],
      alias: ['slug', 'version', 'locale', 'title', 'description', 'safety_notes'],
      values: LOCALES.map((locale) => [
        ...key,
        `${literal(locale)}::public.app_locale`,
        literal(programme[locale].title),
        literal(programme[locale].description),
        jsonb(programme[locale].safetyNotes),
      ]),
      joins: [JOIN_PROGRAMME],
      conflict: ['programme_id', 'locale'],
    }),
  );

  sql.push(
    upsertFrom({
      table: 'programme_weeks',
      columns: [
        'programme_id',
        'week_number',
        'focus_key',
        'volume_multiplier',
        'long_run_ceiling_m',
      ],
      select: [
        'p.id',
        'v.week_number',
        'v.focus_key',
        'v.volume_multiplier',
        'v.long_run_ceiling_m',
      ],
      alias: [
        'slug',
        'version',
        'week_number',
        'focus_key',
        'volume_multiplier',
        'long_run_ceiling_m',
      ],
      values: programme.weeks.map((w) => [
        ...key,
        num(w.weekNumber, 'integer'),
        literal(w.focusKey),
        num(w.volumeMultiplier, 'numeric'),
        num(w.longRunCeilingM, 'integer'),
      ]),
      joins: [JOIN_PROGRAMME],
      conflict: ['programme_id', 'week_number'],
    }),
  );

  sql.push(
    upsertFrom({
      table: 'programme_week_translations',
      columns: ['programme_week_id', 'locale', 'label', 'focus'],
      select: ['w.id', 'v.locale', 'v.label', 'v.focus'],
      alias: ['slug', 'version', 'week_number', 'locale', 'label', 'focus'],
      values: programme.weeks.flatMap((w) =>
        LOCALES.map((locale) => [
          ...key,
          num(w.weekNumber, 'integer'),
          `${literal(locale)}::public.app_locale`,
          literal(w[locale].label),
          literal(w[locale].focus),
        ]),
      ),
      joins: [
        JOIN_PROGRAMME,
        'join public.programme_weeks w on w.programme_id = p.id and w.week_number = v.week_number',
      ],
      conflict: ['programme_week_id', 'locale'],
    }),
  );

  sql.push(
    upsertFrom({
      table: 'session_templates',
      columns: [
        'programme_id',
        'slug',
        'session_type',
        'body_focus',
        'estimated_duration_min',
        'counts_for_adherence',
      ],
      select: [
        'p.id',
        'v.template_slug',
        'v.session_type',
        'v.body_focus',
        'v.estimated_duration_min',
        'v.counts_for_adherence',
      ],
      alias: [
        'slug',
        'version',
        'template_slug',
        'session_type',
        'body_focus',
        'estimated_duration_min',
        'counts_for_adherence',
      ],
      values: programme.templates.map((t) => [
        ...key,
        literal(t.slug),
        `${literal(t.sessionType)}::public.session_type`,
        `${literal(t.bodyFocus)}::public.body_focus`,
        num(t.estimatedDurationMin, 'integer'),
        bool(t.countsForAdherence),
      ]),
      joins: [JOIN_PROGRAMME],
      conflict: ['programme_id', 'slug'],
    }),
  );

  const JOIN_TEMPLATE =
    'join public.session_templates t on t.programme_id = p.id and t.slug = v.template_slug';

  sql.push(
    upsertFrom({
      table: 'session_template_translations',
      columns: ['session_template_id', 'locale', 'title', 'purpose', 'guidance'],
      select: ['t.id', 'v.locale', 'v.title', 'v.purpose', 'v.guidance'],
      alias: ['slug', 'version', 'template_slug', 'locale', 'title', 'purpose', 'guidance'],
      values: programme.templates.flatMap((t) =>
        LOCALES.map((locale) => [
          ...key,
          literal(t.slug),
          `${literal(locale)}::public.app_locale`,
          literal(t[locale].title),
          literal(t[locale].purpose),
          jsonb(t[locale].guidance),
        ]),
      ),
      joins: [JOIN_PROGRAMME, JOIN_TEMPLATE],
      conflict: ['session_template_id', 'locale'],
    }),
  );

  // PRD §11: one row per week and weekday, reusing the templates (8 × 7 = 56 for this programme).
  sql.push(
    upsertFrom({
      table: 'programme_days',
      columns: ['programme_week_id', 'day_of_week', 'session_template_id'],
      select: ['w.id', 'v.day_of_week', 't.id'],
      alias: ['slug', 'version', 'week_number', 'day_of_week', 'template_slug'],
      values: programme.weeks.flatMap((w) =>
        WEEKDAYS.map((day) => [
          ...key,
          num(w.weekNumber, 'integer'),
          num(Number(day), 'smallint'),
          literal(programme.weekPattern[day]!),
        ]),
      ),
      joins: [
        JOIN_PROGRAMME,
        'join public.programme_weeks w on w.programme_id = p.id and w.week_number = v.week_number',
        JOIN_TEMPLATE,
      ],
      conflict: ['programme_week_id', 'day_of_week'],
    }),
  );

  const templateExercises = programme.templates.flatMap((t) =>
    t.exercises.map((e, index) => [
      ...key,
      literal(t.slug),
      num(index + 1, 'integer'),
      literal(e.exercise),
      num(e.sets, 'integer'),
      num('reps' in e.target ? e.target.reps : null, 'integer'),
      num('durationS' in e.target ? e.target.durationS : null, 'integer'),
      num('distanceM' in e.target ? e.target.distanceM : null, 'integer'),
      bool(e.perSide),
      num(e.restS, 'integer'),
    ]),
  );
  sql.push(
    upsertFrom({
      table: 'template_exercises',
      columns: [
        'session_template_id',
        'sequence',
        'exercise_id',
        'target_sets',
        'target_reps',
        'target_duration_s',
        'target_distance_m',
        'per_side',
        'rest_s',
      ],
      select: [
        't.id',
        'v.sequence',
        'e.id',
        'v.target_sets',
        'v.target_reps',
        'v.target_duration_s',
        'v.target_distance_m',
        'v.per_side',
        'v.rest_s',
      ],
      alias: [
        'slug',
        'version',
        'template_slug',
        'sequence',
        'exercise_slug',
        'target_sets',
        'target_reps',
        'target_duration_s',
        'target_distance_m',
        'per_side',
        'rest_s',
      ],
      values: templateExercises,
      joins: [JOIN_PROGRAMME, JOIN_TEMPLATE, 'join public.exercises e on e.slug = v.exercise_slug'],
      conflict: ['session_template_id', 'sequence'],
    }),
  );

  return sql.join('\n\n');
}

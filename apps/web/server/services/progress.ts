import {
  addDays,
  adherenceSeries,
  bestSetSeries,
  buildWeek,
  type Clock,
  compareLocalDates,
  distanceUnitFor,
  type ExerciseSet,
  heatmap,
  type LocalDate,
  localDateAt,
  localDayBounds,
  longRunProgression,
  missedAndSkipped,
  mondayOf,
  monthlyDistance,
  paceSeries,
  personalRecords,
  type ProgressRange,
  rangeBounds,
  runCount,
  runRecords,
  totalDistance,
  trainingStreak,
  type WeekView,
  weeklyDistance,
  weeklyVolume,
} from '@getfit/domain';
import { type Track, track } from '@/lib/observability/analytics';
import { progressRangeSchema } from '@/lib/validation/progress';
import type { DbClient } from '@/server/db/client';
import { type FitnessTestType, findBaselines } from '@/server/repositories/baselines';
import {
  findExerciseNames,
  findFirstLog,
  findProgressRuns,
  findProgressSets,
} from '@/server/repositories/progress';
import { findProfileSettings } from '@/server/repositories/profiles';
import { getCurrentUser } from './auth';
import { loadSchedule } from './schedule';

// PRD §6.8 Progress: one range's strength, running and consistency, computed by the domain (AGENTS §5.3) from what
// was logged (BR-25). Baselines are the labelled starting references, never history (BR-26).

/** The baseline test each exercise is measured against, by its slug (content). */
const BASELINE_TEST: Readonly<Record<string, FitnessTestType>> = {
  'pull-up': 'max_pull_ups',
  'push-up': 'max_push_ups',
  'bodyweight-squat': 'max_squats',
};

/** The Monday of each week from `from` to `to`. */
function mondaysOf(from: LocalDate, to: LocalDate): LocalDate[] {
  const mondays: LocalDate[] = [];
  for (let m = mondayOf(from); compareLocalDates(m, to) <= 0; m = addDays(m, 7)) mondays.push(m);
  return mondays;
}

function earliest(dates: readonly (LocalDate | null)[]): LocalDate | null {
  const present = dates.filter((d): d is LocalDate => d !== null);
  return present.length ? present.reduce((a, b) => (compareLocalDates(a, b) <= 0 ? a : b)) : null;
}

/** The signed-in user's profile, enrolment (if any) and baselines: what every progress read starts from. */
async function loadBase(client: DbClient, clock: Clock) {
  const user = await getCurrentUser(client);
  if (!user) return null;
  const schedule = await loadSchedule(client, clock);
  const enrolled = typeof schedule === 'string' ? null : schedule;
  const profile = enrolled?.profile ?? (await findProfileSettings(client, user.id));
  if (!profile) throw new Error('profile missing for signed-in user');
  const zone = profile.timezone;
  const now = clock.now();
  const [baselines, firstLog] = await Promise.all([
    findBaselines(client, user.id),
    findFirstLog(client, user.id),
  ]);
  const baselineDate = (at: Date | undefined) => (at ? localDateAt(at, zone) : null);
  return {
    userId: user.id,
    enrolled,
    profile,
    zone,
    now,
    today: localDateAt(now, zone),
    baselines,
    /** The earliest log or baseline: where "all" starts (D74). */
    firstLog: earliest([
      firstLog.workout ? localDateAt(firstLog.workout, zone) : null,
      firstLog.run,
      baselineDate(baselines.weight?.at),
      baselineDate(baselines.run?.at),
      ...Object.values(baselines.tests).map((t) => baselineDate(t?.at)),
    ]),
    referenceRun: baselines.run
      ? {
          date: localDateAt(baselines.run.at, zone),
          distanceM: baselines.run.distanceM,
          durationS: baselines.run.durationS,
        }
      : null,
  };
}

type Base = NonNullable<Awaited<ReturnType<typeof loadBase>>>;

const boundsFor = (base: Base, range: ProgressRange) =>
  rangeBounds(range, {
    today: base.today,
    programmeStart: base.enrolled?.enrolment.startDate ?? null,
    firstLog: base.firstLog,
  });

/** The range's logged sets (dated in the user's zone) and runs, and the exercises' names. */
async function loadLogs(client: DbClient, base: Base, bounds: { from: LocalDate; to: LocalDate }) {
  const { zone } = base;
  const [setRows, runs] = await Promise.all([
    findProgressSets(
      client,
      base.userId,
      localDayBounds(bounds.from, zone).start,
      localDayBounds(bounds.to, zone).end,
    ),
    findProgressRuns(client, base.userId, bounds.from, bounds.to),
  ]);
  const sets: (ExerciseSet & { exerciseId: string })[] = setRows.map((s) => ({
    ...s,
    date: localDateAt(s.startedAt, zone),
  }));
  const names = await findExerciseNames(
    client,
    [...new Set(sets.map((s) => s.exerciseId))],
    base.profile.locale,
  );
  return { sets, runs, names };
}

/** Each logged exercise's best set over time and its records, with its baseline test (BR-26). */
function strengthOf(base: Base, logs: Awaited<ReturnType<typeof loadLogs>>) {
  return [...logs.names.entries()].map(([exerciseId, { slug, name }]) => {
    const series = bestSetSeries(logs.sets.filter((s) => s.exerciseId === exerciseId));
    const test = BASELINE_TEST[slug] ? base.baselines.tests[BASELINE_TEST[slug]] : undefined;
    const baseline = test ? { value: test.value, date: localDateAt(test.at, base.zone) } : null;
    /** BR-26: the labelled starting reference, kept even once a record beats it. */
    return { exerciseId, slug, name, series, baseline, records: personalRecords(series, baseline) };
  });
}

/** Every week of the enrolment, from the schedule engine. */
const programmeWeeks = (enrolled: NonNullable<Base['enrolled']>, now: Date): WeekView[] =>
  Array.from({ length: enrolled.programme.shape.durationWeeks }, (_, w) =>
    buildWeek(enrolled.scheduleInput, addDays(enrolled.enrolment.startDate, w * 7), now),
  );

export async function getProgress(
  client: DbClient,
  input: { range?: unknown },
  clock: Clock,
  trackEvent: Track = track,
) {
  const base = await loadBase(client, clock);
  if (!base) return null;
  const { enrolled, profile, today, now, referenceRun } = base;
  const range: ProgressRange = progressRangeSchema.parse(input.range);
  const bounds = boundsFor(base, range);

  await trackEvent({ name: 'progress_viewed', properties: { range } }, base.userId);
  const unit = distanceUnitFor(profile.preferred_units);
  if (!bounds) {
    // Nothing to show for this range: "programme" without an enrolment, or "all" with no log or baseline.
    return { kind: 'no_range' as const, range, units: profile.preferred_units, referenceRun };
  }

  const logs = await loadLogs(client, base, bounds);
  const { sets, runs } = logs;
  const mondays = mondaysOf(bounds.from, bounds.to);

  // Consistency over the programme weeks: the range's for the series, every finished one for the streak (D70).
  let consistency = null;
  if (enrolled) {
    const everyWeek = programmeWeeks(enrolled, now);
    const inRange = everyWeek.filter(
      (w) =>
        compareLocalDates(w.monday, bounds.from) >= 0 &&
        compareLocalDates(w.monday, bounds.to) <= 0,
    );
    consistency = {
      adherence: adherenceSeries(inRange, today),
      streak: trainingStreak(everyWeek, today),
      heatmap: heatmap(inRange),
      ...missedAndSkipped(inRange),
    };
  }

  return {
    kind: 'range' as const,
    range,
    bounds,
    units: profile.preferred_units,
    /** Nothing logged in the range: the page shows empty states, never zeros (BR-24). */
    empty: sets.length === 0 && runs.length === 0,
    referenceRun,
    strength: strengthOf(base, logs),
    volume: weeklyVolume(sets, mondays),
    running: {
      weekly: weeklyDistance(runs, mondays),
      monthly: monthlyDistance(runs),
      count: runCount(runs),
      distanceM: totalDistance(runs),
      pace: paceSeries(runs, unit),
      longRun: longRunProgression(runs),
      records: runRecords(runs, referenceRun),
    },
    consistency,
  };
}

/** How many of the latest records Today shows (PRD §6.3 performance overview). */
const OVERVIEW_RECORDS = 3;

export type OverviewRecord =
  | { kind: 'strength'; name: string; measure: 'reps' | 'seconds'; value: number; date: LocalDate }
  | { kind: 'longest'; metres: number; date: LocalDate }
  /** BR-23: seconds per km, as records keep it; the page shows it in the user's unit. */
  | { kind: 'best_pace'; secondsPerKm: number; date: LocalDate };

/**
 * PRD §6.3: Today's performance overview: the training streak (D70) and the latest personal records, newest first.
 * Records are only ever set by logs, never by a baseline (PRD §6.8, BR-26). No analytics event: this isn't Progress.
 */
export async function getOverview(client: DbClient, clock: Clock) {
  const base = await loadBase(client, clock);
  if (!base) return null;
  const { enrolled, today, now } = base;
  const bounds = boundsFor(base, 'all');
  const logs = bounds ? await loadLogs(client, base, bounds) : null;
  const records: OverviewRecord[] = [];
  if (logs) {
    for (const exercise of strengthOf(base, logs)) {
      if (!exercise.records.available) continue;
      const measure = exercise.series[0]!.best.kind;
      for (const mark of exercise.records.records) {
        records.push({
          kind: 'strength',
          name: exercise.name,
          measure,
          value: mark.value,
          date: mark.date,
        });
      }
    }
    const runs = runRecords(logs.runs, base.referenceRun);
    if (runs.longest.available) {
      for (const mark of runs.longest.records)
        records.push({ kind: 'longest', metres: mark.value, date: mark.date });
    }
    if (runs.bestPace.available) {
      for (const mark of runs.bestPace.records) {
        records.push({ kind: 'best_pace', secondsPerKm: mark.value, date: mark.date });
      }
    }
  }
  return {
    units: base.profile.preferred_units,
    streak: enrolled ? trainingStreak(programmeWeeks(enrolled, now), today) : null,
    records: records.sort((a, b) => compareLocalDates(b.date, a.date)).slice(0, OVERVIEW_RECORDS),
  };
}

export type OverviewView = NonNullable<Awaited<ReturnType<typeof getOverview>>>;

export type ProgressView = NonNullable<Awaited<ReturnType<typeof getProgress>>>;

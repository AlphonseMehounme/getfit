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

export async function getProgress(
  client: DbClient,
  input: { range?: unknown },
  clock: Clock,
  trackEvent: Track = track,
) {
  const user = await getCurrentUser(client);
  if (!user) return null;
  const schedule = await loadSchedule(client, clock);
  const enrolled = typeof schedule === 'string' ? null : schedule;
  const profile = enrolled?.profile ?? (await findProfileSettings(client, user.id));
  if (!profile) throw new Error('profile missing for signed-in user');
  const zone = profile.timezone;
  const now = clock.now();
  const today = localDateAt(now, zone);
  const range: ProgressRange = progressRangeSchema.parse(input.range);

  const [baselines, firstLog] = await Promise.all([
    findBaselines(client, user.id),
    findFirstLog(client, user.id),
  ]);
  const baselineDate = (at: Date | undefined) => (at ? localDateAt(at, zone) : null);
  const bounds = rangeBounds(range, {
    today,
    programmeStart: enrolled?.enrolment.startDate ?? null,
    firstLog: earliest([
      firstLog.workout ? localDateAt(firstLog.workout, zone) : null,
      firstLog.run,
      baselineDate(baselines.weight?.at),
      baselineDate(baselines.run?.at),
      ...Object.values(baselines.tests).map((t) => baselineDate(t?.at)),
    ]),
  });

  await trackEvent({ name: 'progress_viewed', properties: { range } }, user.id);
  const unit = distanceUnitFor(profile.preferred_units);
  const referenceRun = baselines.run
    ? {
        date: localDateAt(baselines.run.at, zone),
        distanceM: baselines.run.distanceM,
        durationS: baselines.run.durationS,
      }
    : null;
  if (!bounds) {
    // Nothing to show for this range: "programme" without an enrolment, or "all" with no log or baseline.
    return { kind: 'no_range' as const, range, units: profile.preferred_units, referenceRun };
  }

  const from = localDayBounds(bounds.from, zone).start;
  const to = localDayBounds(bounds.to, zone).end;
  const [setRows, runs] = await Promise.all([
    findProgressSets(client, user.id, from, to),
    findProgressRuns(client, user.id, bounds.from, bounds.to),
  ]);
  const sets: (ExerciseSet & { exerciseId: string })[] = setRows.map((s) => ({
    ...s,
    date: localDateAt(s.startedAt, zone),
  }));
  const names = await findExerciseNames(
    client,
    [...new Set(sets.map((s) => s.exerciseId))],
    profile.locale,
  );
  const mondays = mondaysOf(bounds.from, bounds.to);

  const strength = [...names.entries()].map(([exerciseId, { slug, name }]) => {
    const series = bestSetSeries(sets.filter((s) => s.exerciseId === exerciseId));
    const test = BASELINE_TEST[slug] ? baselines.tests[BASELINE_TEST[slug]] : undefined;
    const baseline = test ? { value: test.value, date: localDateAt(test.at, zone) } : null;
    /** BR-26: the labelled starting reference, kept even once a record beats it. */
    return { exerciseId, slug, name, series, baseline, records: personalRecords(series, baseline) };
  });

  // Consistency over the programme weeks: the range's for the series, every finished one for the streak (D70).
  let consistency = null;
  if (enrolled) {
    const everyWeek: WeekView[] = Array.from(
      { length: enrolled.programme.shape.durationWeeks },
      (_, w) =>
        buildWeek(enrolled.scheduleInput, addDays(enrolled.enrolment.startDate, w * 7), now),
    );
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
    strength,
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

export type ProgressView = NonNullable<Awaited<ReturnType<typeof getProgress>>>;

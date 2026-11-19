import {
  checkPace,
  distanceUnitFor,
  type DistanceUnit,
  loadForDisplay,
  massUnitFor,
  type MassUnit,
  metresTo,
  type PaceCheck,
  roundTo,
  runMetrics,
  type RunMetrics,
  toMetres,
  type UnitSystem,
} from '@getfit/domain';

// Onboarding step 6 (BR-26): the form's values, typed in the user's units, to and from the step schema's input.
// Every number is optional: an empty field is null. Pace and speed always come from the domain (BR-22, AGENTS §5.3).

/** The saved baselines the step shows again (D51), in storage units. */
export interface SavedBaselines {
  weight: { id: string; weightKg: number } | null;
  maxPullUps: { id: string; value: number } | null;
  maxPushUps: { id: string; value: number } | null;
  maxSquats: { id: string; value: number } | null;
  run: { id: string; distanceM: number; durationS: number; rpe: number | null } | null;
}

export interface BaselineValues {
  weight: number | null;
  maxPullUps: number | null;
  maxPushUps: number | null;
  maxSquats: number | null;
  distance: number | null;
  hours: number | null;
  minutes: number | null;
  seconds: number | null;
  effort: string;
  /** Only carries the run-wide error (a distance without a time, or the reverse). */
  run?: undefined;
}

/** The ID of each record: the saved one's, or one made on the device (AGENTS §6). */
export type BaselineIds = Record<
  'weight' | 'maxPullUps' | 'maxPushUps' | 'maxSquats' | 'run',
  string
>;

export const TEST_FIELDS = ['maxPullUps', 'maxPushUps', 'maxSquats'] as const;

export const unitsFor = (system: UnitSystem): { mass: MassUnit; distance: DistanceUnit } => ({
  mass: massUnitFor(system),
  distance: distanceUnitFor(system),
});

export function baselineIds(saved: SavedBaselines, newId: () => string): BaselineIds {
  return {
    weight: saved.weight?.id ?? newId(),
    maxPullUps: saved.maxPullUps?.id ?? newId(),
    maxPushUps: saved.maxPushUps?.id ?? newId(),
    maxSquats: saved.maxSquats?.id ?? newId(),
    run: saved.run?.id ?? newId(),
  };
}

export function baselineDefaults(saved: SavedBaselines, system: UnitSystem): BaselineValues {
  const units = unitsFor(system);
  const run = saved.run;
  return {
    weight: saved.weight ? loadForDisplay(saved.weight.weightKg, units.mass) : null,
    maxPullUps: saved.maxPullUps?.value ?? null,
    maxPushUps: saved.maxPushUps?.value ?? null,
    maxSquats: saved.maxSquats?.value ?? null,
    distance: run ? roundTo(metresTo(run.distanceM, units.distance), 2) : null,
    hours: run ? Math.floor(run.durationS / 3600) : null,
    minutes: run ? Math.floor((run.durationS % 3600) / 60) : null,
    seconds: run ? run.durationS % 60 : null,
    effort: run?.rpe ? String(run.rpe) : '',
  };
}

/** h, min and s as seconds; null when all three are empty. */
export function durationOf(v: Pick<BaselineValues, 'hours' | 'minutes' | 'seconds'>) {
  if (v.hours === null && v.minutes === null && v.seconds === null) return null;
  return (v.hours ?? 0) * 3600 + (v.minutes ?? 0) * 60 + (v.seconds ?? 0);
}

/** The run as stored (whole metres and seconds, BR-20), or null while either part is missing or not > 0. */
export function runMeasurement(
  v: Pick<BaselineValues, 'distance' | 'hours' | 'minutes' | 'seconds'>,
  unit: DistanceUnit,
) {
  const durationS = durationOf(v);
  if (v.distance === null || !Number.isFinite(v.distance) || durationS === null) return null;
  const distanceM = toMetres(v.distance, unit);
  return distanceM > 0 && Number.isInteger(durationS) && durationS > 0
    ? { distanceM, durationS }
    : null;
}

/** BR-22 / BR-23: the live pace and speed, or null (shown as "—", BR-24). */
export function liveMetrics(
  v: Pick<BaselineValues, 'distance' | 'hours' | 'minutes' | 'seconds'>,
  unit: DistanceUnit,
): RunMetrics | null {
  const run = runMeasurement(v, unit);
  return run ? runMetrics(run.distanceM, run.durationS, unit) : null;
}

/** BR-21: whether this run's pace asks for a confirmation; never a block. */
export function paceCheck(
  v: Pick<BaselineValues, 'distance' | 'hours' | 'minutes' | 'seconds'>,
  unit: DistanceUnit,
): PaceCheck {
  const run = runMeasurement(v, unit);
  return run ? checkPace(run) : { needsConfirmation: false };
}

/**
 * The schema's input. An empty part is null: it clears a saved baseline (D52) and changes nothing otherwise. A
 * half-filled run is sent as it is, so the schema reports the missing part.
 */
export function baselinesInput(v: BaselineValues, ids: BaselineIds, system: UnitSystem) {
  const units = unitsFor(system);
  const test = (field: (typeof TEST_FIELDS)[number]) =>
    v[field] === null ? null : { id: ids[field], value: v[field] };
  const durationS = durationOf(v);
  return {
    weight: v.weight === null ? null : { id: ids.weight, value: v.weight, unit: units.mass },
    maxPullUps: test('maxPullUps'),
    maxPushUps: test('maxPushUps'),
    maxSquats: test('maxSquats'),
    run:
      v.distance === null && durationS === null
        ? null
        : {
            id: ids.run,
            distance: v.distance,
            distanceUnit: units.distance,
            durationS,
            effort: v.effort ? Number(v.effort) : null,
          },
  };
}

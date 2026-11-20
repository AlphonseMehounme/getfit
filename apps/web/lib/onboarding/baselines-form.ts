import {
  distanceUnitFor,
  type DistanceUnit,
  loadForDisplay,
  massUnitFor,
  type MassUnit,
  metresTo,
  roundTo,
  type UnitSystem,
} from '@getfit/domain';
import { durationOf, splitDuration } from '@/lib/running/run-values';

// Onboarding step 6 (BR-26): the form's values, typed in the user's units, to and from the step schema's input.
// Every number is optional: an empty field is null. Pace, speed and the BR-21 check are in lib/running/run-values.

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
    ...(run ? splitDuration(run.durationS) : { hours: null, minutes: null, seconds: null }),
    effort: run?.rpe ? String(run.rpe) : '',
  };
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

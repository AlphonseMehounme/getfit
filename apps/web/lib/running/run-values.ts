import {
  checkPace,
  type DistanceUnit,
  type PaceCheck,
  runMetrics,
  type RunMetrics,
  toMetres,
} from '@getfit/domain';

// A run as typed in a form (onboarding step 6 and the run log, PRD §6.6): a distance in the user's unit and a time
// as h / min / s, each empty (null) until typed. One implementation for both forms (AGENTS §5.3); pace and speed
// always come from the domain (BR-22).

export interface RunParts {
  distance: number | null;
  hours: number | null;
  minutes: number | null;
  seconds: number | null;
}

/** h, min and s as seconds; null when all three are empty. */
export function durationOf(v: Pick<RunParts, 'hours' | 'minutes' | 'seconds'>) {
  if (v.hours === null && v.minutes === null && v.seconds === null) return null;
  return (v.hours ?? 0) * 3600 + (v.minutes ?? 0) * 60 + (v.seconds ?? 0);
}

/** Seconds as h / min / s, to pre-fill a form. */
export function splitDuration(durationS: number) {
  return {
    hours: Math.floor(durationS / 3600),
    minutes: Math.floor((durationS % 3600) / 60),
    seconds: durationS % 60,
  };
}

/** The run as stored (whole metres and seconds, BR-20), or null while either part is missing or not > 0. */
export function runMeasurement(v: RunParts, unit: DistanceUnit) {
  const durationS = durationOf(v);
  if (v.distance === null || !Number.isFinite(v.distance) || durationS === null) return null;
  const distanceM = toMetres(v.distance, unit);
  return distanceM > 0 && Number.isInteger(durationS) && durationS > 0
    ? { distanceM, durationS }
    : null;
}

/** BR-22 / BR-23: the live pace and speed, or null (shown as "—", BR-24). */
export function liveMetrics(v: RunParts, unit: DistanceUnit): RunMetrics | null {
  const run = runMeasurement(v, unit);
  return run ? runMetrics(run.distanceM, run.durationS, unit) : null;
}

/** BR-21: whether this run's pace asks for a confirmation; never a block. */
export function paceCheck(v: RunParts, unit: DistanceUnit): PaceCheck {
  const run = runMeasurement(v, unit);
  return run ? checkPace(run) : { needsConfirmation: false };
}

/** Identifies a run's measurement, so a BR-21 confirmation applies only to the run it was asked for. */
export const runKey = (v: RunParts) => [v.distance, v.hours, v.minutes, v.seconds].join('|');

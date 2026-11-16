import { z } from 'zod';
import { paceSeconds } from './pace';

// BR-20 / BR-21: a run needs whole metres > 0 and whole seconds > 0. A pace outside
// 2:30–20:00 /km asks the user to confirm; it never blocks the entry.

export const RUN_VALIDATION_ERROR_KEYS = [
  'distanceRequired',
  'distancePositive',
  'durationRequired',
  'durationPositive',
] as const;
export type RunValidationErrorKey = (typeof RUN_VALIDATION_ERROR_KEYS)[number];

/** Messages are keys; the UI translates them (AGENTS §9). Mirrors the `running_sessions` checks. */
export const runMeasurementSchema = z.object({
  distanceM: z
    .number({ error: 'distanceRequired' })
    .int('distancePositive')
    .positive('distancePositive'),
  durationS: z
    .number({ error: 'durationRequired' })
    .int('durationPositive')
    .positive('durationPositive'),
});
export type RunMeasurement = z.infer<typeof runMeasurementSchema>;

/** BR-21: 2:30 /km. */
export const PLAUSIBLE_PACE_MIN_S_PER_KM = 150;
/** BR-21: 20:00 /km. */
export const PLAUSIBLE_PACE_MAX_S_PER_KM = 1200;

export type PaceCheck =
  | { needsConfirmation: false }
  | { needsConfirmation: true; reason: 'paceTooFast' | 'paceTooSlow'; paceSPerKm: number };

/**
 * BR-21: checks a valid run's pace. The bounds apply to the pace as shown (rounded to the second,
 * BR-23), so a run displayed as 2:30 /km never asks for confirmation.
 */
export function checkPace(run: RunMeasurement): PaceCheck {
  const paceSPerKm = Math.round(paceSeconds(run.distanceM, run.durationS, 'km'));
  if (paceSPerKm < PLAUSIBLE_PACE_MIN_S_PER_KM) {
    return { needsConfirmation: true, reason: 'paceTooFast', paceSPerKm };
  }
  if (paceSPerKm > PLAUSIBLE_PACE_MAX_S_PER_KM) {
    return { needsConfirmation: true, reason: 'paceTooSlow', paceSPerKm };
  }
  return { needsConfirmation: false };
}

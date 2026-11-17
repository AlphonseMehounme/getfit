import {
  distanceUnitFor,
  metresTo,
  type Prescription,
  roundTo,
  type Target,
  type UnitSystem,
} from '@getfit/domain';

// Display only: turns a resolved prescription into a message key and its values. The text lives in messages
// (`Today.target.*`, `Today.rest.*`), so the wording is translated (AGENTS §9). Units are converted here, at
// display (AGENTS §6).

export type TargetMessage =
  | { key: 'reps' | 'repsPerSide'; values: { sets: number; reps: number } }
  | { key: 'seconds' | 'secondsPerSide'; values: { sets: number; seconds: number } }
  | { key: 'minutes' | 'minutesPerSide'; values: { sets: number; minutes: number } }
  | { key: 'distance'; values: { distance: number; unit: 'km' | 'mi' } };

export type RestMessage =
  { key: 'seconds'; values: { seconds: number } } | { key: 'minutes'; values: { minutes: number } };

/** Whole minutes from 2 min up read better as minutes ("30 min"); anything else stays in seconds ("45 s"). */
const inMinutes = (seconds: number) => seconds >= 120 && seconds % 60 === 0;

/** BR-14: "3 × 6"; BR-16: "3 × 10 per side"; BR-15: the long run is a ceiling, "Up to 11 km". */
export function targetMessage(prescription: Prescription, units: UnitSystem): TargetMessage {
  const { sets, target, perSide } = prescription;
  switch (target.kind) {
    case 'reps':
      return { key: perSide ? 'repsPerSide' : 'reps', values: { sets, reps: target.reps } };
    case 'duration':
      return inMinutes(target.seconds)
        ? {
            key: perSide ? 'minutesPerSide' : 'minutes',
            values: { sets, minutes: target.seconds / 60 },
          }
        : {
            key: perSide ? 'secondsPerSide' : 'seconds',
            values: { sets, seconds: target.seconds },
          };
    case 'distance': {
      const unit = distanceUnitFor(units);
      return {
        key: 'distance',
        values: { distance: roundTo(metresTo(target.metres, unit), 1), unit },
      };
    }
  }
}

export function restMessage(restS: number): RestMessage {
  return inMinutes(restS)
    ? { key: 'minutes', values: { minutes: restS / 60 } }
    : { key: 'seconds', values: { seconds: restS } };
}

export interface SetMeasure {
  kind: 'reps' | 'seconds';
  /** The target a set row is pre-filled with (BR-14). */
  value: number;
}

/** What one set of a strength exercise records: reps, or seconds for a hold. */
export function setMeasure(target: Target): SetMeasure {
  if (target.kind === 'reps') return { kind: 'reps', value: target.reps };
  if (target.kind === 'duration') return { kind: 'seconds', value: target.seconds };
  throw new RangeError('A distance target is not logged as sets (BR-15)');
}

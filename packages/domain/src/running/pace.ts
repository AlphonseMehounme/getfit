import { metresPerUnit, type DistanceUnit } from '../units/distance';
import { roundTo } from '../units/system';

// BR-22: pace and speed are always computed from duration and distance, never typed in or stored.
// BR-23: pace is rounded to the nearest second, speed to one decimal.

function assertRun(distanceM: number, durationS: number) {
  if (!(distanceM > 0) || !(durationS > 0) || !Number.isFinite(distanceM + durationS)) {
    throw new RangeError('Pace needs a distance and a duration > 0 (BR-21)');
  }
}

/** BR-22: exact pace in seconds per km or mile (10,840 m in 4,770 s → 440.03 s/km). */
export function paceSeconds(distanceM: number, durationS: number, unit: DistanceUnit = 'km') {
  assertRun(distanceM, durationS);
  return durationS / (distanceM / metresPerUnit(unit));
}

/** BR-22: exact speed in km/h or mph. */
export function speed(distanceM: number, durationS: number, unit: DistanceUnit = 'km') {
  assertRun(distanceM, durationS);
  return distanceM / metresPerUnit(unit) / (durationS / 3600);
}

export interface RunMetrics {
  unit: DistanceUnit;
  /** BR-23: whole seconds per unit; format with `formatPace`. */
  paceS: number;
  /** BR-23: one decimal, km/h or mph. */
  speed: number;
}

/** BR-22 / BR-23: the one implementation behind every pace and speed the app shows (AGENTS §5.3). */
export function runMetrics(
  distanceM: number,
  durationS: number,
  unit: DistanceUnit = 'km',
): RunMetrics {
  return {
    unit,
    paceS: Math.round(paceSeconds(distanceM, durationS, unit)),
    speed: roundTo(speed(distanceM, durationS, unit), 1),
  };
}

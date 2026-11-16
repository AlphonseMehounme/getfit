import { assertFinite, type UnitSystem } from './system';

// BR-20: distances are stored as whole metres. Display uses km (metric) or miles (imperial).

export const METRES_PER_KM = 1000;
/** International mile, exact by definition. */
export const METRES_PER_MILE = 1609.344;

export type DistanceUnit = 'km' | 'mi';

export const distanceUnitFor = (system: UnitSystem): DistanceUnit =>
  system === 'imperial' ? 'mi' : 'km';

export const metresPerUnit = (unit: DistanceUnit) =>
  unit === 'mi' ? METRES_PER_MILE : METRES_PER_KM;

/** Exact conversion for display; the UI formats the number for the locale. */
export function metresTo(metres: number, unit: DistanceUnit): number {
  assertFinite(metres, 'A distance');
  return metres / metresPerUnit(unit);
}

/** BR-20: user input in km or mi becomes whole metres for storage. */
export function toMetres(value: number, unit: DistanceUnit): number {
  assertFinite(value, 'A distance');
  return Math.round(value * metresPerUnit(unit));
}

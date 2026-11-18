import { assertFinite, roundTo } from './system';

// AGENTS §6: mass is stored in kilograms (`weight_kg`, `load_kg`, two decimals); pounds are display only.

/** International avoirdupois pound, exact by definition. */
export const KG_PER_LB = 0.45359237;

export type MassUnit = 'kg' | 'lb';

export function kgToLb(kg: number): number {
  assertFinite(kg, 'A mass');
  return kg / KG_PER_LB;
}

export function lbToKg(lb: number): number {
  assertFinite(lb, 'A mass');
  return lb * KG_PER_LB;
}

function assertLoad(value: number) {
  assertFinite(value, 'A load');
  if (value < 0) throw new RangeError('A load is ≥ 0');
}

/** D41: a stored load (kg) in the user's unit, to 0.1 (20 kg → 44.1 lb). The UI formats it for the locale. */
export function loadForDisplay(kg: number, unit: MassUnit): number {
  assertLoad(kg);
  return roundTo(unit === 'lb' ? kgToLb(kg) : kg, 1);
}

/** D41: a load typed in the user's unit, as kg to 0.01 for `load_kg` (45 lb → 20.41 kg). */
export function loadToKg(value: number, unit: MassUnit): number {
  assertLoad(value);
  return roundTo(unit === 'lb' ? lbToKg(value) : value, 2);
}

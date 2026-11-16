import { assertFinite } from './system';

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

import { inchesToCm } from '../units/length';
import { lbToKg, type MassUnit } from '../units/mass';
import { assertFinite, roundTo } from '../units/system';

// AGENTS §6: onboarding answers are typed in the user's unit and stored in centimetres and kilograms (run distances use `toMetres`).

export type LengthUnit = 'cm' | 'in';

/** `profiles.height_cm` holds one decimal (65 in → 165.1 cm). */
export function heightToCm(value: number, unit: LengthUnit): number {
  assertFinite(value, 'A height');
  return roundTo(unit === 'in' ? inchesToCm(value) : value, 1);
}

/** `body_measurements.weight_kg` holds two decimals (121 lb → 54.88 kg). */
export function weightToKg(value: number, unit: MassUnit): number {
  assertFinite(value, 'A weight');
  return roundTo(unit === 'lb' ? lbToKg(value) : value, 2);
}

import { assertFinite } from './system';

// AGENTS §6: body lengths are stored in centimetres (`height_cm`, one decimal); inches are display only.

/** Exact by definition. */
export const CM_PER_INCH = 2.54;
export const INCHES_PER_FOOT = 12;

export function cmToInches(cm: number): number {
  assertFinite(cm, 'A length');
  return cm / CM_PER_INCH;
}

export function inchesToCm(inches: number): number {
  assertFinite(inches, 'A length');
  return inches * CM_PER_INCH;
}

/**
 * Height in feet and whole inches (165 cm → 5 ft 5 in). Inches are rounded first,
 * so the result never shows 12 inches (182.8 cm → 6 ft 0 in, not 5 ft 12 in).
 */
export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  if (!(cm >= 0)) throw new RangeError('A length is ≥ 0');
  const totalInches = Math.round(cmToInches(cm));
  return {
    feet: Math.floor(totalInches / INCHES_PER_FOOT),
    inches: totalInches % INCHES_PER_FOOT,
  };
}

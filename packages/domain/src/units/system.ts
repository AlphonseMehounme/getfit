// AGENTS §6: the database stores metres, seconds, kilograms and centimetres; conversion happens only at display.

/** Matches the `unit_system` enum on `profiles.preferred_units`. */
export type UnitSystem = 'metric' | 'imperial';

/** Removes binary floating-point noise (0.1 + 0.2) before rounding. */
export const clean = (value: number) => Math.round(value * 1e9) / 1e9;

/** Half-up rounding to `decimals` places, safe against float noise (8.25 → 8.3). */
export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.floor(clean(value * factor) + 0.5) / factor;
}

export function assertFinite(value: number, what: string) {
  if (!Number.isFinite(value)) throw new RangeError(`${what} must be a finite number`);
}

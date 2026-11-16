// BR-17 / D11 / D25: the deload week scales sets only; reps, durations, rest and per-side are unchanged.

/** Removes binary floating-point noise (3 × 0.65 = 1.9500000000000002) before rounding. */
const clean = (value: number) => Math.round(value * 1e9) / 1e9;

/** D25: half-up rounding, so x.5 always goes up. */
export const roundHalfUp = (value: number) => Math.floor(clean(value) + 0.5);

function assertMultiplier(multiplier: number) {
  if (!(multiplier > 0 && multiplier <= 1)) {
    throw new RangeError('A volume multiplier is in (0, 1] (BR-17, BR-18)');
  }
}

/** BR-17: sets = max(1, round(sets × multiplier)); 3 → 2 and 2 → 1 at 0.65. */
export function deloadSets(sets: number, multiplier: number): number {
  if (!Number.isInteger(sets) || sets < 1) throw new RangeError('Sets are a whole number ≥ 1');
  assertMultiplier(multiplier);
  return Math.max(1, roundHalfUp(sets * multiplier));
}

/**
 * D25: a week's long-run ceiling = base × multiplier, rounded down to a whole km
 * (11,000 m × 0.65 → 7,000 m). The seed is tested against this; the week row stays authoritative.
 */
export function longRunCeilingFor(baseMetres: number, multiplier: number): number {
  if (!Number.isInteger(baseMetres) || baseMetres < 1000) {
    throw new RangeError('A long-run base is a whole number of metres ≥ 1,000');
  }
  assertMultiplier(multiplier);
  return Math.floor(clean(baseMetres * multiplier) / 1000) * 1000;
}

// BR-16: a per-side target applies to each side, and volume counts both sides.
import type { Prescription, Target } from './types';

export interface PrescribedVolume {
  /** Sets to log: 3 sets per leg are 6 set rows. */
  setCount: number;
  /** The target summed over every set and side, in the target's own unit. */
  total: Target;
}

export const sidesOf = (perSide: boolean) => (perSide ? 2 : 1);

export function prescribedVolume(
  prescription: Pick<Prescription, 'sets' | 'target' | 'perSide'>,
): PrescribedVolume {
  const setCount = prescription.sets * sidesOf(prescription.perSide);
  const { target } = prescription;
  switch (target.kind) {
    case 'reps':
      return { setCount, total: { kind: 'reps', reps: target.reps * setCount } };
    case 'duration':
      return { setCount, total: { kind: 'duration', seconds: target.seconds * setCount } };
    case 'distance':
      return { setCount, total: { kind: 'distance', metres: target.metres * setCount } };
  }
}

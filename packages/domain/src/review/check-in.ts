// PRD §6.9 / D72: the recovery check-in. Scales are 1–5; pain is yes / no, with an area and an optional note.

/** D72: where it hurts. */
export const PAIN_AREAS = [
  'neck',
  'shoulder',
  'elbow_wrist',
  'back',
  'hip',
  'knee',
  'ankle_foot',
  'other',
] as const;
export type PainArea = (typeof PAIN_AREAS)[number];

export interface CheckIn {
  fatigue: number | null;
  soreness: number | null;
  sleep: number | null;
  motivation: number | null;
  pain: boolean;
  painArea: PainArea | null;
  painNote: string | null;
}

/** D69 / D64: recovery is low when fatigue or soreness is 4 or more, or sleep 2 or less. */
export const recoveryLow = (c: CheckIn) =>
  (c.fatigue ?? 0) >= 4 || (c.soreness ?? 0) >= 4 || (c.sleep !== null && c.sleep <= 2);

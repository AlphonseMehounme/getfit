import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { finishSessionSchema, logSetSchema, startSessionSchema } from './workout';

const set = (overrides: Record<string, unknown> = {}) => ({
  id: randomUUID(),
  sessionId: randomUUID(),
  exerciseId: randomUUID(),
  setNumber: 1,
  side: 'both',
  completed: true,
  ...overrides,
});

describe('startSessionSchema', () => {
  it('D21: needs a client-generated UUID and the programme day', () => {
    expect(
      startSessionSchema.safeParse({ sessionId: randomUUID(), programmeDayId: randomUUID() })
        .success,
    ).toBe(true);
    expect(
      startSessionSchema.safeParse({ sessionId: 'abc', programmeDayId: randomUUID() }).success,
    ).toBe(false);
    expect(startSessionSchema.safeParse({ sessionId: randomUUID() }).success).toBe(false);
  });
});

describe('logSetSchema', () => {
  it('accepts reps, load and reps in reserve, defaulting the rest to null', () => {
    expect(logSetSchema.parse(set({ actualReps: 6, loadKg: 12.5, rir: 2 }))).toMatchObject({
      actualReps: 6,
      actualDurationS: null,
      loadKg: 12.5,
      rir: 2,
    });
  });

  it('accepts a timed hold, and a set with no measure', () => {
    expect(logSetSchema.safeParse(set({ actualDurationS: 45 })).success).toBe(true);
    expect(logSetSchema.parse(set())).toMatchObject({ actualReps: null, actualDurationS: null });
  });

  it('refuses reps and seconds together, and out-of-range values', () => {
    expect(logSetSchema.safeParse(set({ actualReps: 6, actualDurationS: 45 })).success).toBe(false);
    for (const bad of [
      { setNumber: 0 },
      { side: 'middle' },
      { actualReps: -1 },
      { loadKg: 1000 },
      { loadKg: 1.234 },
      { rir: 11 },
      { extra: true },
    ]) {
      expect(logSetSchema.safeParse(set(bad)).success).toBe(false);
    }
  });
});

describe('finishSessionSchema', () => {
  const finish = (overrides: Record<string, unknown> = {}) => ({
    sessionId: randomUUID(),
    save: 'completed',
    confirm: true,
    ...overrides,
  });

  it('BR-5: requires an explicit confirmation', () => {
    expect(finishSessionSchema.safeParse(finish()).success).toBe(true);
    expect(finishSessionSchema.safeParse(finish({ confirm: false })).success).toBe(false);
    expect(finishSessionSchema.safeParse(finish({ confirm: undefined })).success).toBe(false);
  });

  it('takes an optional RPE from 1 to 10 and trimmed notes', () => {
    expect(finishSessionSchema.parse(finish({ rpe: 7, notes: '  good  ' }))).toMatchObject({
      rpe: 7,
      notes: 'good',
    });
    expect(finishSessionSchema.parse(finish())).toMatchObject({ rpe: null, notes: null });
    expect(finishSessionSchema.safeParse(finish({ rpe: 0 })).success).toBe(false);
    expect(finishSessionSchema.safeParse(finish({ rpe: 11 })).success).toBe(false);
    expect(finishSessionSchema.safeParse(finish({ save: 'done' })).success).toBe(false);
  });
});

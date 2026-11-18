import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  finishSessionSchema,
  logSetSchema,
  pauseSessionSchema,
  startSessionSchema,
} from './workout';

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
  it('D41: accepts reps, load in the user unit and reps in reserve, defaulting the rest', () => {
    expect(
      logSetSchema.parse(set({ actualReps: 6, load: 45, loadUnit: 'lb', rir: 2 })),
    ).toMatchObject({
      actualReps: 6,
      actualDurationS: null,
      load: 45,
      loadUnit: 'lb',
      rir: 2,
      substitutedForExerciseId: null,
    });
    expect(logSetSchema.parse(set({ load: 12.5 }))).toMatchObject({ load: 12.5, loadUnit: 'kg' });
  });

  it('D40: takes the replaced exercise, never the same exercise', () => {
    const exerciseId = randomUUID();
    const replaced = randomUUID();
    expect(
      logSetSchema.parse(set({ exerciseId, substitutedForExerciseId: replaced })),
    ).toMatchObject({ exerciseId, substitutedForExerciseId: replaced });
    expect(
      logSetSchema.safeParse(set({ exerciseId, substitutedForExerciseId: exerciseId })).success,
    ).toBe(false);
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
      { load: -1 },
      { load: 2001 },
      { loadUnit: 'stone' },
      { loadKg: 12 },
      { substitutedForExerciseId: 'abc' },
      { rir: 11 },
      { extra: true },
    ]) {
      expect(logSetSchema.safeParse(set(bad)).success).toBe(false);
    }
  });
});

describe('pauseSessionSchema', () => {
  it('D34: takes only the session ID', () => {
    expect(pauseSessionSchema.safeParse({ sessionId: randomUUID() }).success).toBe(true);
    expect(pauseSessionSchema.safeParse({ sessionId: 'abc' }).success).toBe(false);
    expect(pauseSessionSchema.safeParse({ sessionId: randomUUID(), at: 1 }).success).toBe(false);
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

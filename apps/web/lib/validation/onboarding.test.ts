import { randomUUID } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import {
  availabilityStepSchema,
  baselinesStepSchema,
  equipmentStepSchema,
  experienceStepSchema,
  goalsStepSchema,
  profileStepSchema,
} from './onboarding';

const profile = profileStepSchema(2026);
const step1 = (overrides: Record<string, unknown> = {}) => ({
  firstName: 'Alex',
  units: 'metric',
  timezone: 'Europe/Paris',
  ...overrides,
});
const firstError = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

describe('profileStepSchema (PRD §6.2 step 1)', () => {
  it('needs only the starred fields, and trims the first name', () => {
    const parsed = profile.parse(step1({ firstName: '  Alex ' }));
    expect(parsed).toEqual({
      firstName: 'Alex',
      birthYear: null,
      height: null,
      heightUnit: 'cm',
      units: 'metric',
      timezone: 'Europe/Paris',
    });
  });

  it('accepts the optional fields', () => {
    expect(
      profile.safeParse(step1({ birthYear: 1998, height: 65, heightUnit: 'in', units: 'imperial' }))
        .success,
    ).toBe(true);
  });

  it('rejects an empty or a too-long first name', () => {
    expect(firstError(profile.safeParse(step1({ firstName: '   ' })))).toBe('firstNameRequired');
    expect(firstError(profile.safeParse(step1({ firstName: 'x'.repeat(51) })))).toBe(
      'firstNameTooLong',
    );
    expect(profile.safeParse(step1({ firstName: undefined })).success).toBe(false);
  });

  it('rejects a birth year before 1900 or after the current year', () => {
    expect(profile.safeParse(step1({ birthYear: 1899 })).success).toBe(false);
    expect(profile.safeParse(step1({ birthYear: 2027 })).success).toBe(false);
    expect(profile.safeParse(step1({ birthYear: 2026 })).success).toBe(true);
  });

  it('rejects an impossible height, an unknown unit and an unknown time zone', () => {
    expect(profile.safeParse(step1({ height: 0 })).success).toBe(false);
    expect(profile.safeParse(step1({ units: 'stone' })).success).toBe(false);
    expect(firstError(profile.safeParse(step1({ timezone: 'Mars/Olympus' })))).toBe(
      'unknownTimeZone',
    );
  });

  it('rejects unknown fields', () => {
    expect(profile.safeParse(step1({ age: 28 })).success).toBe(false);
  });
});

describe('goals, experience and equipment (steps 2–4)', () => {
  it('accepts any subset of the goals, including none', () => {
    expect(goalsStepSchema.safeParse({ goals: [] }).success).toBe(true);
    expect(goalsStepSchema.safeParse({ goals: ['improve_running', 'maintain'] }).success).toBe(
      true,
    );
  });

  it('rejects an unknown or repeated goal', () => {
    expect(goalsStepSchema.safeParse({ goals: ['fly'] }).success).toBe(false);
    expect(firstError(goalsStepSchema.safeParse({ goals: ['maintain', 'maintain'] }))).toBe(
      'duplicate',
    );
  });

  it('takes one experience level, or none', () => {
    expect(experienceStepSchema.safeParse({ experience: 'beginner' }).success).toBe(true);
    expect(experienceStepSchema.safeParse({ experience: null }).success).toBe(true);
    expect(experienceStepSchema.safeParse({ experience: 'expert' }).success).toBe(false);
  });

  it('takes the equipment as a set', () => {
    expect(equipmentStepSchema.safeParse({ equipment: ['pull_up_bar', 'gym'] }).success).toBe(true);
    expect(equipmentStepSchema.safeParse({ equipment: ['gym', 'gym'] }).success).toBe(false);
  });
});

describe('availabilityStepSchema (step 5, D36)', () => {
  it('takes a kind for some or all weekdays, and a preferred duration', () => {
    const parsed = availabilityStepSchema.parse({
      days: { '1': 'training', '7': 'running' },
      preferredDurationMin: 45,
    });
    expect(parsed.days).toEqual({ '1': 'training', '7': 'running' });
    expect(availabilityStepSchema.parse({ days: {} }).preferredDurationMin).toBeNull();
  });

  it('rejects two running days, a weekday outside 1–7 and a duration out of range', () => {
    expect(
      firstError(availabilityStepSchema.safeParse({ days: { '6': 'running', '7': 'running' } })),
    ).toBe('oneRunningDay');
    expect(availabilityStepSchema.safeParse({ days: { '8': 'rest' } }).success).toBe(false);
    expect(availabilityStepSchema.safeParse({ days: {}, preferredDurationMin: 5 }).success).toBe(
      false,
    );
  });
});

describe('baselinesStepSchema (step 6, BR-26, D52)', () => {
  const run = { id: randomUUID(), distance: 10.84, distanceUnit: 'km', durationS: 4770 };

  it('every part is optional; null clears it', () => {
    expect(baselinesStepSchema.parse({})).toEqual({});
    expect(baselinesStepSchema.parse({ weight: null, run: null })).toEqual({
      weight: null,
      run: null,
    });
  });

  it('takes the reference profile (PRD §7)', () => {
    const parsed = baselinesStepSchema.parse({
      weight: { id: randomUUID(), value: 55, unit: 'kg' },
      maxPullUps: { id: randomUUID(), value: 10 },
      maxPushUps: { id: randomUUID(), value: 20 },
      maxSquats: { id: randomUUID(), value: 40 },
      run: { ...run, effort: 7 },
    });
    expect(parsed.run?.effort).toBe(7);
    expect(baselinesStepSchema.parse({ run }).run?.effort).toBeNull();
  });

  it('BR-21: rejects a distance of 0, and a duration without a distance', () => {
    expect(firstError(baselinesStepSchema.safeParse({ run: { ...run, distance: 0 } }))).toBe(
      'distancePositive',
    );
    expect(baselinesStepSchema.safeParse({ run: { ...run, distance: undefined } }).success).toBe(
      false,
    );
    expect(firstError(baselinesStepSchema.safeParse({ run: { ...run, durationS: 0 } }))).toBe(
      'durationPositive',
    );
  });

  it('rejects a negative test, a test without its id and an unknown weight unit', () => {
    expect(
      baselinesStepSchema.safeParse({ maxPushUps: { id: randomUUID(), value: -1 } }).success,
    ).toBe(false);
    expect(baselinesStepSchema.safeParse({ maxPushUps: { value: 20 } }).success).toBe(false);
    expect(
      baselinesStepSchema.safeParse({ weight: { id: randomUUID(), value: 55, unit: 'st' } })
        .success,
    ).toBe(false);
  });
});

import { isValidTimeZone, runMeasurementSchema } from '@getfit/domain';
import { z } from 'zod';

// PRD §6.2: one schema per onboarding step, the same on the device and on the server (AGENTS §2). Values are typed
// in the user's unit; the server stores centimetres, kilograms and metres (AGENTS §6). IDs of baseline records are
// generated on the device, so a retry is idempotent (AGENTS §6, D21).

export const GOAL_TYPES = [
  'build_muscle',
  'increase_strength',
  'improve_endurance',
  'improve_running',
  'general_fitness',
  'maintain',
] as const;
export const EXPERIENCE_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;
export const EQUIPMENT_TYPES = [
  'bodyweight',
  'pull_up_bar',
  'dumbbells',
  'barbell',
  'bands',
  'gym',
  'other',
] as const;
export const AVAILABILITY_KINDS = ['training', 'running', 'rest'] as const;

/** A multi-select: each value at most once. */
const uniqueList = <T extends readonly [string, ...string[]]>(values: T) =>
  z
    .array(z.enum(values))
    .max(values.length)
    .refine((list) => new Set(list).size === list.length, { message: 'duplicate' });

/** Step 1. The birth year is checked against the current year from the injected clock. */
export const profileStepSchema = (currentYear: number) =>
  z.strictObject({
    firstName: z.string().trim().min(1, 'firstNameRequired').max(50, 'firstNameTooLong'),
    birthYear: z.int().min(1900).max(currentYear).nullable().default(null),
    height: z.number().positive().max(300).nullable().default(null),
    heightUnit: z.enum(['cm', 'in']).default('cm'),
    units: z.enum(['metric', 'imperial']),
    // The database checks the name against Postgres's list as the last line (profiles_timezone_known).
    timezone: z.string().refine(isValidTimeZone, { message: 'unknownTimeZone' }),
  });

export const goalsStepSchema = z.strictObject({ goals: uniqueList(GOAL_TYPES) });

export const experienceStepSchema = z.strictObject({
  experience: z.enum(EXPERIENCE_LEVELS).nullable(),
});

export const equipmentStepSchema = z.strictObject({ equipment: uniqueList(EQUIPMENT_TYPES) });

const weekday = z.enum(['1', '2', '3', '4', '5', '6', '7']);

/** Step 5 (D36): stored, never applied to the schedule. */
export const availabilityStepSchema = z.strictObject({
  days: z
    .partialRecord(weekday, z.enum(AVAILABILITY_KINDS))
    // PRD §6.2: one running day.
    .refine((days) => Object.values(days).filter((kind) => kind === 'running').length <= 1, {
      message: 'oneRunningDay',
    }),
  preferredDurationMin: z.int().min(10).max(180).nullable().default(null),
});

const id = z.uuid();
const testValue = z.int().min(0).max(500);
const baselineTest = z.strictObject({ id, value: testValue }).nullable();

/**
 * Step 6 (BR-26). A part left out is unchanged; `null` clears it (D52). A distance and a duration come together
 * (BR-20, BR-21); the distance is converted to whole metres before the run checks.
 */
export const baselinesStepSchema = z.strictObject({
  weight: z
    .strictObject({
      id,
      value: z.number().positive().max(1000),
      unit: z.enum(['kg', 'lb']),
    })
    .nullable()
    .optional(),
  maxPullUps: baselineTest.optional(),
  maxPushUps: baselineTest.optional(),
  maxSquats: baselineTest.optional(),
  run: z
    .strictObject({
      id,
      distance: z.number().positive('distancePositive').max(1000),
      distanceUnit: z.enum(['km', 'mi']),
      durationS: runMeasurementSchema.shape.durationS.max(86_400),
      effort: z.int().min(1).max(10).nullable().default(null),
    })
    .nullable()
    .optional(),
});

export type ProfileStepInput = z.input<ReturnType<typeof profileStepSchema>>;
export type GoalsStepInput = z.input<typeof goalsStepSchema>;
export type ExperienceStepInput = z.input<typeof experienceStepSchema>;
export type EquipmentStepInput = z.input<typeof equipmentStepSchema>;
export type AvailabilityStepInput = z.input<typeof availabilityStepSchema>;
export type BaselinesStepInput = z.input<typeof baselinesStepSchema>;

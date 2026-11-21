import { PROGRESS_RANGES } from '@getfit/domain';
import { z } from 'zod';

// D74: the Progress range, from the address. A missing or unknown value reads as 8 weeks, the programme's length.
export const DEFAULT_PROGRESS_RANGE = '8w';
export const progressRangeSchema = z.enum(PROGRESS_RANGES).catch(DEFAULT_PROGRESS_RANGE);

/** The re-tests, by field, and the stored test each one is (D73). */
export const RETEST_FIELDS = {
  maxPullUps: 'max_pull_ups',
  maxPushUps: 'max_push_ups',
  maxSquats: 'max_squats',
} as const;

const retest = z.strictObject({ id: z.uuid(), value: z.int().min(0).max(500) });

/** D73: the week-8 re-tests, each optional, at least one; the same bounds as the baselines (onboarding step 6). */
export const retestSchema = z
  .strictObject({
    maxPullUps: retest.optional(),
    maxPushUps: retest.optional(),
    maxSquats: retest.optional(),
  })
  .refine((v) => Object.values(v).some(Boolean), { message: 'oneRequired' });

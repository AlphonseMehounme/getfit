import { localDateAt, toMetres, weightToKg } from '@getfit/domain';
import type { z } from 'zod';
import type { baselinesStepSchema } from '@/lib/validation/onboarding';
import type { DbClient } from '@/server/db/client';
import {
  type BaselineRecord,
  type FitnessTestType,
  findBaselines,
  softDeleteBaseline,
  upsertBaselineRun,
  upsertBaselineTest,
  upsertBaselineWeight,
} from '@/server/repositories/baselines';

// Onboarding step 6 (BR-26). A baseline already saved keeps its ID and its first date, so a re-save corrects it
// (D51); a part sent as null is soft-deleted (D52); a part left out is unchanged.

type BaselinesStep = z.output<typeof baselinesStepSchema>;

const TESTS: readonly [keyof BaselinesStep & `max${string}`, FitnessTestType][] = [
  ['maxPullUps', 'max_pull_ups'],
  ['maxPushUps', 'max_push_ups'],
  ['maxSquats', 'max_squats'],
];

/** D51: the existing record's ID and date, or the device's ID dated now. */
const target = (existing: BaselineRecord | null | undefined, id: string, now: Date) =>
  existing ? { id: existing.id, at: existing.at } : { id, at: now };

export async function saveBaselines(
  client: DbClient,
  user: { id: string; timezone: string },
  step: BaselinesStep,
  now: Date,
) {
  const current = await findBaselines(client, user.id);
  const writes: Promise<void>[] = [];

  if (step.weight === null && current.weight) {
    writes.push(softDeleteBaseline(client, 'body_measurements', current.weight.id, now));
  } else if (step.weight) {
    writes.push(
      upsertBaselineWeight(client, {
        ...target(current.weight, step.weight.id, now),
        userId: user.id,
        now,
        weightKg: weightToKg(step.weight.value, step.weight.unit),
      }),
    );
  }

  for (const [field, testType] of TESTS) {
    const value = step[field];
    const existing = current.tests[testType];
    if (value === null && existing) {
      writes.push(softDeleteBaseline(client, 'fitness_tests', existing.id, now));
    } else if (value) {
      writes.push(
        upsertBaselineTest(client, {
          ...target(existing, value.id, now),
          userId: user.id,
          now,
          testType,
          value: value.value,
        }),
      );
    }
  }

  if (step.run === null && current.run) {
    writes.push(softDeleteBaseline(client, 'running_sessions', current.run.id, now));
  } else if (step.run) {
    const { id, at } = target(current.run, step.run.id, now);
    writes.push(
      upsertBaselineRun(client, {
        id,
        at,
        userId: user.id,
        now,
        // BR-26: dated at onboarding, in the user's time zone.
        localDate: localDateAt(at, user.timezone),
        distanceM: toMetres(step.run.distance, step.run.distanceUnit),
        durationS: step.run.durationS,
        rpe: step.run.effort,
      }),
    );
  }

  await Promise.all(writes);
}

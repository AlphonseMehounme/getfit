import type { LocalDate } from '@getfit/domain';
import type { DbClient } from '@/server/db/client';
import type { Database } from '@/server/db/types';

// Onboarding step 6 (BR-26): baselines are reference values, flagged `is_baseline`, never sessions. Writes are upserts
// by the device's ID (AGENTS §6); clearing one is a soft delete (D52), so the deletion syncs across devices.

export type FitnessTestType = Database['public']['Enums']['fitness_test_type'];

export interface BaselineRecord {
  id: string;
  /** When it was first saved (D51). */
  at: Date;
}

export interface Baselines {
  weight: (BaselineRecord & { weightKg: number }) | null;
  tests: Partial<Record<FitnessTestType, BaselineRecord & { value: number }>>;
  run: (BaselineRecord & { distanceM: number; durationS: number; rpe: number | null }) | null;
}

const fail = (table: string, code: string | undefined): never => {
  throw new Error(`${table}: ${code}`);
};

/** The user's current baselines; the earliest wins if an old client ever wrote two. */
export async function findBaselines(client: DbClient, userId: string): Promise<Baselines> {
  const [weights, tests, runs] = await Promise.all([
    client
      .from('body_measurements')
      .select('id, measured_at, weight_kg')
      .eq('user_id', userId)
      .eq('is_baseline', true)
      .not('weight_kg', 'is', null)
      .is('deleted_at', null)
      .order('measured_at')
      .limit(1),
    client
      .from('fitness_tests')
      .select('id, tested_at, test_type, value')
      .eq('user_id', userId)
      .eq('is_baseline', true)
      .is('deleted_at', null)
      .order('tested_at', { ascending: false }),
    client
      .from('running_sessions')
      .select('id, started_at, distance_m, duration_s, rpe')
      .eq('user_id', userId)
      .eq('is_baseline', true)
      .is('deleted_at', null)
      .order('started_at')
      .limit(1),
  ]);
  if (weights.error) fail('body_measurements', weights.error.code);
  if (tests.error) fail('fitness_tests', tests.error.code);
  if (runs.error) fail('running_sessions', runs.error.code);

  const weight = weights.data![0];
  const run = runs.data![0];
  const byType: Baselines['tests'] = {};
  // Newest first, so the earliest of each type is written last and wins.
  for (const t of tests.data!) {
    byType[t.test_type] = { id: t.id, at: new Date(t.tested_at), value: t.value };
  }
  return {
    weight: weight
      ? { id: weight.id, at: new Date(weight.measured_at), weightKg: Number(weight.weight_kg) }
      : null,
    tests: byType,
    run: run
      ? {
          id: run.id,
          at: new Date(run.started_at),
          distanceM: run.distance_m,
          durationS: run.duration_s,
          rpe: run.rpe,
        }
      : null,
  };
}

interface Write {
  id: string;
  userId: string;
  at: Date;
  now: Date;
}

export async function upsertBaselineWeight(client: DbClient, w: Write & { weightKg: number }) {
  const { error } = await client.from('body_measurements').upsert(
    {
      id: w.id,
      user_id: w.userId,
      measured_at: w.at.toISOString(),
      weight_kg: w.weightKg,
      is_baseline: true,
      client_updated_at: w.now.toISOString(),
      deleted_at: null,
    },
    { onConflict: 'id' },
  );
  if (error) fail('body_measurements', error.code);
}

export async function upsertBaselineTest(
  client: DbClient,
  w: Write & { testType: FitnessTestType; value: number },
) {
  const { error } = await client.from('fitness_tests').upsert(
    {
      id: w.id,
      user_id: w.userId,
      tested_at: w.at.toISOString(),
      test_type: w.testType,
      value: w.value,
      is_baseline: true,
      client_updated_at: w.now.toISOString(),
      deleted_at: null,
    },
    { onConflict: 'id' },
  );
  if (error) fail('fitness_tests', error.code);
}

/** BR-26: the reference run is unlinked (running_sessions_baseline_unlinked) and never fulfils a programme day. */
export async function upsertBaselineRun(
  client: DbClient,
  w: Write & { localDate: LocalDate; distanceM: number; durationS: number; rpe: number | null },
) {
  const { error } = await client.from('running_sessions').upsert(
    {
      id: w.id,
      user_id: w.userId,
      started_at: w.at.toISOString(),
      local_date: w.localDate,
      distance_m: w.distanceM,
      duration_s: w.durationS,
      rpe: w.rpe,
      source: 'manual',
      is_baseline: true,
      client_updated_at: w.now.toISOString(),
      deleted_at: null,
    },
    { onConflict: 'id' },
  );
  if (error) fail('running_sessions', error.code);
}

/** D52: a cleared baseline is soft-deleted. */
export async function softDeleteBaseline(
  client: DbClient,
  table: 'body_measurements' | 'fitness_tests' | 'running_sessions',
  id: string,
  now: Date,
) {
  const { error } = await client
    .from(table)
    .update({ deleted_at: now.toISOString(), client_updated_at: now.toISOString() })
    .eq('id', id);
  if (error) fail(table, error.code);
}

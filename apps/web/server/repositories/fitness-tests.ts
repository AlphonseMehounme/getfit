import type { DbClient } from '@/server/db/client';
import type { FitnessTestType } from './baselines';

// D73: the week-8 re-tests, `fitness_tests` rows that are not baselines. Each one is kept (BR-25); the latest counts.

const fail = (code: string | undefined): never => {
  throw new Error(`fitness_tests: ${code}`);
};

/** The latest re-test of each type. */
export async function findLatestRetests(
  client: DbClient,
  userId: string,
): Promise<Partial<Record<FitnessTestType, { value: number; at: Date }>>> {
  const { data, error } = await client
    .from('fitness_tests')
    .select('test_type, value, tested_at')
    .eq('user_id', userId)
    .eq('is_baseline', false)
    .is('deleted_at', null)
    .order('tested_at', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) fail(error.code);
  const latest: Partial<Record<FitnessTestType, { value: number; at: Date }>> = {};
  // Newest first: the first row of each type is its latest.
  for (const row of data!) {
    latest[row.test_type] ??= { value: row.value, at: new Date(row.tested_at) };
  }
  return latest;
}

/** An upsert by the device's ID (AGENTS §6). */
export async function upsertRetest(
  client: DbClient,
  w: { id: string; userId: string; testType: FitnessTestType; value: number; at: Date },
) {
  const { error } = await client.from('fitness_tests').upsert(
    {
      id: w.id,
      user_id: w.userId,
      tested_at: w.at.toISOString(),
      test_type: w.testType,
      value: w.value,
      is_baseline: false,
      client_updated_at: w.at.toISOString(),
      deleted_at: null,
    },
    { onConflict: 'id' },
  );
  if (error) fail(error.code);
}

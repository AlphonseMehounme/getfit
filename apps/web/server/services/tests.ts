import { type Clock, compareRetest, localDateAt, retestOffered } from '@getfit/domain';
import { RETEST_FIELDS, retestSchema } from '@/lib/validation/progress';
import type { DbClient } from '@/server/db/client';
import { findBaselines } from '@/server/repositories/baselines';
import { findLatestRetests, upsertRetest } from '@/server/repositories/fitness-tests';
import { loadSchedule } from './schedule';

// D73 / PRD §7: the week-8 re-tests, offered in the programme's last week and compared with each baseline (BR-26).
// Nothing is sent to analytics: values are personal and no PRD event covers them (AGENTS §12).

const FIELDS = Object.keys(RETEST_FIELDS) as (keyof typeof RETEST_FIELDS)[];

export async function getRetests(client: DbClient, clock: Clock) {
  const schedule = await loadSchedule(client, clock);
  if (schedule === 'not_signed_in') return null;
  if (schedule === 'not_enrolled') return { offered: false, tests: [] };
  const { userId, profile, enrolment, programme } = schedule;
  const zone = profile.timezone;
  const today = localDateAt(clock.now(), zone);
  const [baselines, latest] = await Promise.all([
    findBaselines(client, userId),
    findLatestRetests(client, userId),
  ]);
  const mark = (m: { value: number; at: Date } | undefined) =>
    m ? { value: m.value, date: localDateAt(m.at, zone) } : null;
  return {
    offered: retestOffered(today, enrolment.startDate, programme.shape.durationWeeks),
    tests: FIELDS.map((field) => {
      const type = RETEST_FIELDS[field];
      return { field, ...compareRetest(mark(baselines.tests[type]), mark(latest[type])) };
    }),
  };
}

export type RetestsView = NonNullable<Awaited<ReturnType<typeof getRetests>>>;

export type LogRetestsResult =
  { ok: true } | { ok: false; error: 'invalid_input' | 'not_signed_in' | 'not_offered' };

/** D73: saves the re-tests given, dated now. New IDs each time, so earlier ones are kept and the latest counts. */
export async function logRetests(
  client: DbClient,
  input: unknown,
  clock: Clock,
): Promise<LogRetestsResult> {
  const schedule = await loadSchedule(client, clock);
  if (schedule === 'not_signed_in') return { ok: false, error: 'not_signed_in' };
  const parsed = retestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  if (schedule === 'not_enrolled') return { ok: false, error: 'not_offered' };
  const now = clock.now();
  const { userId, profile, enrolment, programme } = schedule;
  const today = localDateAt(now, profile.timezone);
  if (!retestOffered(today, enrolment.startDate, programme.shape.durationWeeks)) {
    return { ok: false, error: 'not_offered' };
  }
  for (const field of FIELDS) {
    const test = parsed.data[field];
    if (!test) continue;
    await upsertRetest(client, {
      id: test.id,
      userId,
      testType: RETEST_FIELDS[field],
      value: test.value,
      at: now,
    });
  }
  return { ok: true };
}

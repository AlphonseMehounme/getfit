import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  insertProgrammeFixture,
  type ProgrammeFixture,
  removeProgrammeFixture,
} from './content-fixtures';
import { anonClient, connectDb, createTestUser, type TestUser, withRollback } from './helpers';

// PRD §12 isolation for the activity tables of P1-03b (PRD §11 user tables; RLS owner only),
// plus the constraints that protect logged history (BR-5, BR-20, BR-25, D5, D26).

const PERMISSION_DENIED = '42501';
const UNIQUE_VIOLATION = '23505';
const CHECK_VIOLATION = '23514';
const FK_VIOLATION = '23503';
const WEEK_1_MONDAY = '2026-11-23';
const MONDAY_MORNING = '2026-11-23T07:00:00Z';
const MONDAY_LATER = '2026-11-23T07:40:00Z';
const SUNDAY_MORNING = '2026-11-29T08:00:00Z';
const SNAPSHOT = { version: 1, exercises: [] };

const api = (client: unknown) => client as SupabaseClient;

let alice: TestUser;
let bob: TestUser;
let content: ProgrammeFixture;

interface OwnRows {
  enrolmentId: string;
  workoutSessionId: string;
  workoutSetId: string;
  runId: string;
  measurementId: string;
  fitnessTestId: string;
  reviewId: string;
}

let aliceRows: OwnRows;
let bobRows: OwnRows;

async function mustInsert(user: TestUser, table: string, row: Record<string, unknown>) {
  const { error } = await api(user.client).from(table).insert(row);
  if (error) throw new Error(`${table}: ${error.message}`);
}

/** A completed Strength A session linked to week 1 Monday, as the service will write it. */
const completedSession = (user: TestUser, enrolmentId: string, id: string = randomUUID()) => ({
  id,
  user_id: user.id,
  user_programme_id: enrolmentId,
  programme_day_id: content.programmeDayId,
  scheduled_date: WEEK_1_MONDAY,
  session_template_id: content.templateId,
  prescription_snapshot: SNAPSHOT,
  status: 'completed',
  started_at: MONDAY_MORNING,
  completed_at: MONDAY_LATER,
  duration_s: 2400,
  rpe: 7,
  client_updated_at: MONDAY_LATER,
});

const setRow = (sessionId: string, id: string = randomUUID()) => ({
  id,
  workout_session_id: sessionId,
  exercise_id: content.exerciseId,
  set_number: 1,
  actual_reps: 6,
  logged_at: MONDAY_MORNING,
  client_updated_at: MONDAY_MORNING,
});

const runRow = (user: TestUser, id: string = randomUUID()) => ({
  id,
  user_id: user.id,
  started_at: SUNDAY_MORNING,
  local_date: '2026-11-29',
  distance_m: 10840,
  duration_s: 4770,
  rpe: 5,
  client_updated_at: SUNDAY_MORNING,
});

/** Each user fills every activity table through their own session, which also proves owners can write. */
async function seedOwnRows(user: TestUser): Promise<OwnRows> {
  const enrolmentId = randomUUID();
  await mustInsert(user, 'user_programmes', {
    id: enrolmentId,
    user_id: user.id,
    programme_id: content.programmeId,
    programme_version: 1,
    start_date: WEEK_1_MONDAY,
    start_mode: 'next_monday',
  });
  const rows: OwnRows = {
    enrolmentId,
    workoutSessionId: randomUUID(),
    workoutSetId: randomUUID(),
    runId: randomUUID(),
    measurementId: randomUUID(),
    fitnessTestId: randomUUID(),
    reviewId: randomUUID(),
  };
  await mustInsert(
    user,
    'workout_sessions',
    completedSession(user, enrolmentId, rows.workoutSessionId),
  );
  await mustInsert(user, 'workout_sets', setRow(rows.workoutSessionId, rows.workoutSetId));
  await mustInsert(user, 'running_sessions', runRow(user, rows.runId));
  await mustInsert(user, 'body_measurements', {
    id: rows.measurementId,
    user_id: user.id,
    measured_at: MONDAY_MORNING,
    weight_kg: 55,
    is_baseline: true,
    client_updated_at: MONDAY_MORNING,
  });
  await mustInsert(user, 'fitness_tests', {
    id: rows.fitnessTestId,
    user_id: user.id,
    tested_at: MONDAY_MORNING,
    test_type: 'max_pull_ups',
    value: 10,
    is_baseline: true,
    client_updated_at: MONDAY_MORNING,
  });
  await mustInsert(user, 'weekly_reviews', {
    id: rows.reviewId,
    user_id: user.id,
    user_programme_id: enrolmentId,
    week_start: WEEK_1_MONDAY,
    fatigue: 2,
    soreness: 2,
    sleep_quality: 4,
    motivation: 4,
    client_updated_at: SUNDAY_MORNING,
  });
  return rows;
}

interface TableCase {
  table: string;
  aliceId: () => string;
  change: Record<string, unknown>;
  /** Bob tries to create a row owned by Alice. */
  forged: () => Record<string, unknown>;
}

const cases: TableCase[] = [
  {
    table: 'workout_sessions',
    aliceId: () => aliceRows.workoutSessionId,
    change: { notes: 'changed' },
    forged: () => ({
      ...completedSession(alice, aliceRows.enrolmentId),
      status: 'in_progress',
      completed_at: null,
    }),
  },
  {
    table: 'workout_sets',
    aliceId: () => aliceRows.workoutSetId,
    change: { actual_reps: 3 },
    forged: () => ({ ...setRow(aliceRows.workoutSessionId), set_number: 2 }),
  },
  {
    table: 'running_sessions',
    aliceId: () => aliceRows.runId,
    change: { route_name: 'changed' },
    forged: () => runRow(alice),
  },
  {
    table: 'body_measurements',
    aliceId: () => aliceRows.measurementId,
    change: { notes: 'changed' },
    forged: () => ({
      id: randomUUID(),
      user_id: alice.id,
      measured_at: SUNDAY_MORNING,
      weight_kg: 60,
      client_updated_at: SUNDAY_MORNING,
    }),
  },
  {
    table: 'fitness_tests',
    aliceId: () => aliceRows.fitnessTestId,
    change: { value: 99 },
    forged: () => ({
      id: randomUUID(),
      user_id: alice.id,
      tested_at: SUNDAY_MORNING,
      test_type: 'max_squats',
      value: 1,
      client_updated_at: SUNDAY_MORNING,
    }),
  },
  {
    table: 'weekly_reviews',
    aliceId: () => aliceRows.reviewId,
    change: { notes: 'changed' },
    forged: () => ({
      id: randomUUID(),
      user_id: alice.id,
      week_start: '2026-11-30',
      client_updated_at: SUNDAY_MORNING,
    }),
  },
];

async function readAs(user: TestUser, table: string, id: string) {
  const { data, error } = await api(user.client).from(table).select('*').eq('id', id);
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

beforeAll(async () => {
  const db = await connectDb();
  try {
    content = await insertProgrammeFixture(db);
  } finally {
    await db.end();
  }
  [alice, bob] = await Promise.all([createTestUser(), createTestUser()]);
  [aliceRows, bobRows] = await Promise.all([seedOwnRows(alice), seedOwnRows(bob)]);
});

afterAll(async () => {
  await Promise.all([alice?.remove(), bob?.remove()]);
  const db = await connectDb();
  try {
    if (content) await removeProgrammeFixture(db, content);
  } finally {
    await db.end();
  }
});

describe.each(cases)('$table isolation', (c) => {
  it('the owner can read their row', async () => {
    expect(await readAs(alice, c.table, c.aliceId())).toHaveLength(1);
  });

  it("another user cannot read the owner's row", async () => {
    expect(await readAs(bob, c.table, c.aliceId())).toEqual([]);
  });

  it("another user cannot update the owner's row", async () => {
    const before = await readAs(alice, c.table, c.aliceId());
    const { data, error } = await api(bob.client)
      .from(c.table)
      .update(c.change)
      .eq('id', c.aliceId())
      .select();
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(await readAs(alice, c.table, c.aliceId())).toEqual(before);
  });

  it("another user cannot overwrite the owner's row by upserting its ID", async () => {
    const before = await readAs(alice, c.table, c.aliceId());
    const { error } = await api(bob.client)
      .from(c.table)
      .upsert({ ...before[0], ...c.change });
    expect(error?.code).toBe(PERMISSION_DENIED);
    expect(await readAs(alice, c.table, c.aliceId())).toEqual(before);
  });

  it('BR-25: nobody can hard-delete a row through the API, not even the owner', async () => {
    for (const user of [bob, alice]) {
      const { error } = await api(user.client).from(c.table).delete().eq('id', c.aliceId());
      expect(error?.code).toBe(PERMISSION_DENIED);
    }
    expect(await readAs(alice, c.table, c.aliceId())).toHaveLength(1);
  });

  it('another user cannot create a row owned by the owner', async () => {
    const { error } = await api(bob.client).from(c.table).insert(c.forged());
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it('anonymous visitors cannot read the table', async () => {
    const { error } = await api(anonClient()).from(c.table).select('*').limit(1);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});

describe('forged ownership', () => {
  it("a user cannot link their session to someone else's enrolment (D26)", async () => {
    const { error } = await api(bob.client)
      .from('workout_sessions')
      .insert({
        ...completedSession(bob, aliceRows.enrolmentId),
        status: 'in_progress',
        completed_at: null,
      });
    expect(error?.code).toBe(FK_VIOLATION);
  });

  it("a user cannot link their run or review to someone else's enrolment", async () => {
    const run = await api(bob.client)
      .from('running_sessions')
      .insert({
        ...runRow(bob),
        user_programme_id: aliceRows.enrolmentId,
        programme_day_id: content.programmeDayId,
        scheduled_date: WEEK_1_MONDAY,
      });
    expect(run.error?.code).toBe(FK_VIOLATION);
    const review = await api(bob.client).from('weekly_reviews').insert({
      id: randomUUID(),
      user_id: bob.id,
      user_programme_id: aliceRows.enrolmentId,
      week_start: '2026-11-30',
      client_updated_at: SUNDAY_MORNING,
    });
    expect(review.error?.code).toBe(FK_VIOLATION);
  });

  it("a user cannot move their set into someone else's session", async () => {
    const { error } = await api(bob.client)
      .from('workout_sets')
      .update({ workout_session_id: aliceRows.workoutSessionId })
      .eq('id', bobRows.workoutSetId);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it('a user cannot hand their session to someone else', async () => {
    const { error } = await api(bob.client)
      .from('workout_sessions')
      .update({ user_id: alice.id })
      .eq('id', bobRows.workoutSessionId);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});

describe('policy definitions', () => {
  const expected = Object.fromEntries(cases.map((c) => [c.table, ['INSERT', 'SELECT', 'UPDATE']]));

  it('each table has exactly select, insert and update owner policies, for authenticated only', async () => {
    const db = await connectDb();
    try {
      const { rows } = await db.query<{ tablename: string; cmd: string; roles: string[] }>(
        `select tablename, cmd, roles::text[] as roles from pg_policies
          where schemaname = 'public' and tablename = any($1) order by tablename, cmd`,
        [Object.keys(expected)],
      );
      const byTable: Record<string, string[]> = {};
      for (const row of rows) {
        expect(row.roles).toEqual(['authenticated']);
        (byTable[row.tablename] ??= []).push(row.cmd);
      }
      expect(byTable).toEqual(expected);
    } finally {
      await db.end();
    }
  });

  it('every USING and WITH CHECK clause is an ownership check', async () => {
    const db = await connectDb();
    try {
      const { rows } = await db.query<{ policyname: string; clause: string }>(
        `select policyname, clause from pg_policies,
                lateral (values (qual), (with_check)) as c(clause)
          where schemaname = 'public' and tablename = any($1) and clause is not null`,
        [Object.keys(expected)],
      );
      expect(rows.length).toBeGreaterThan(0);
      const owner =
        /^\(user_id = \( SELECT auth\.uid\(\) AS uid\)\)$|^owns_workout_session\(workout_session_id\)$/;
      expect(rows.filter((r) => !owner.test(r.clause))).toEqual([]);
    } finally {
      await db.end();
    }
  });

  it('the isolation suites cover every user table (13 in Phase 1)', async () => {
    const db = await connectDb();
    try {
      // A user table is any public table whose policies are not the content tables' `using (true)`.
      const { rows } = await db.query<{ tablename: string }>(
        `select distinct tablename from pg_policies
          where schemaname = 'public' and coalesce(qual, '') <> 'true' order by tablename`,
      );
      expect(rows.map((r) => r.tablename)).toEqual([
        'body_measurements',
        'fitness_tests',
        'prescription_overrides',
        'profiles',
        'running_sessions',
        'schedule_overrides',
        'user_availability',
        'user_equipment',
        'user_goals',
        'user_programmes',
        'weekly_reviews',
        'workout_sessions',
        'workout_sets',
      ]);
    } finally {
      await db.end();
    }
  });
});

describe('idempotent writes (D21)', () => {
  it('upserting the same set three times leaves one row with the latest values', async () => {
    const set = setRow(aliceRows.workoutSessionId);
    for (const reps of [4, 5, 6]) {
      const { error } = await api(alice.client)
        .from('workout_sets')
        .upsert({ ...set, set_number: 3, actual_reps: reps });
      expect(error).toBeNull();
    }
    const rows = await readAs(alice, 'workout_sets', set.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ actual_reps: 6 });
  });
});

describe('history is immutable (BR-25)', () => {
  it('the prescription snapshot cannot change after the session is written', async () => {
    const { error } = await api(alice.client)
      .from('workout_sessions')
      .update({ prescription_snapshot: { version: 1, exercises: ['changed'] } })
      .eq('id', aliceRows.workoutSessionId);
    expect(error?.code).toBe(CHECK_VIOLATION);
  });

  it('an enrolment with logged history cannot be deleted', async () => {
    const { error } = await api(alice.client)
      .from('user_programmes')
      .delete()
      .eq('id', aliceRows.enrolmentId);
    expect(error?.code).toBe(FK_VIOLATION);
  });

  it('a soft delete is an update the owner can make', async () => {
    const run = runRow(alice);
    await mustInsert(alice, 'running_sessions', run);
    const { error } = await api(alice.client)
      .from('running_sessions')
      .update({ deleted_at: SUNDAY_MORNING })
      .eq('id', run.id);
    expect(error).toBeNull();
  });
});

/** Inserts as the database owner inside a rolled-back transaction. */
async function insertAsOwner(db: pg.Client, table: string, row: Record<string, unknown>) {
  const columns = Object.keys(row);
  const values = Object.values(row).map((v) =>
    v !== null && typeof v === 'object' ? JSON.stringify(v) : v,
  );
  await db.query(
    `insert into public.${table} (${columns.join(', ')})
     values (${columns.map((_, i) => `$${i + 1}`).join(', ')})`,
    values,
  );
}

describe('one fulfilment per programme day (D26)', () => {
  const second = (values: Record<string, unknown>) =>
    withRollback((db) =>
      insertAsOwner(db, 'workout_sessions', {
        ...completedSession(alice, aliceRows.enrolmentId),
        ...values,
      }),
    );

  it('rejects a second completed session for the same programme day', async () => {
    await expect(second({})).rejects.toMatchObject({ code: UNIQUE_VIOLATION });
  });

  it('rejects a partial session next to a completed one', async () => {
    await expect(second({ status: 'partial' })).rejects.toMatchObject({ code: UNIQUE_VIOLATION });
  });

  it('accepts a soft-deleted or in-progress session for the same day', async () => {
    await expect(second({ deleted_at: MONDAY_LATER })).resolves.toBeUndefined();
    await expect(second({ status: 'in_progress', completed_at: null })).resolves.toBeUndefined();
  });

  it('a soft-deleted session frees the day', async () => {
    await expect(
      withRollback(async (db) => {
        await db.query('update public.workout_sessions set deleted_at = now() where id = $1', [
          aliceRows.workoutSessionId,
        ]);
        await insertAsOwner(db, 'workout_sessions', completedSession(alice, aliceRows.enrolmentId));
      }),
    ).resolves.toBeUndefined();
  });

  it('allows one linked, non-deleted run per programme day', async () => {
    const linked = () => ({
      ...runRow(alice),
      user_programme_id: aliceRows.enrolmentId,
      programme_day_id: content.programmeDayId,
      scheduled_date: WEEK_1_MONDAY,
    });
    await expect(
      withRollback(async (db) => {
        await insertAsOwner(db, 'running_sessions', { ...linked(), deleted_at: SUNDAY_MORNING });
        await insertAsOwner(db, 'running_sessions', linked());
        await insertAsOwner(db, 'running_sessions', linked());
      }),
    ).rejects.toMatchObject({
      code: UNIQUE_VIOLATION,
      constraint: 'running_sessions_one_fulfilment',
    });
  });
});

describe('constraints', () => {
  const rejects = (table: string, row: Record<string, unknown>, constraint: string) =>
    expect(withRollback((db) => insertAsOwner(db, table, row))).rejects.toMatchObject({
      constraint,
    });

  it('BR-20 / BR-21: a run needs a distance and a duration above zero', async () => {
    await rejects(
      'running_sessions',
      { ...runRow(alice), distance_m: 0 },
      'running_sessions_distance_positive',
    );
    await rejects(
      'running_sessions',
      { ...runRow(alice), duration_s: 0 },
      'running_sessions_duration_positive',
    );
  });

  it('BR-26: a baseline run never fulfils a programme day', async () => {
    await rejects(
      'running_sessions',
      {
        ...runRow(alice),
        is_baseline: true,
        user_programme_id: aliceRows.enrolmentId,
        programme_day_id: content.programmeDayId,
        scheduled_date: WEEK_1_MONDAY,
      },
      'running_sessions_baseline_unlinked',
    );
  });

  it('D5: a weekly review starts on a Monday', async () => {
    await rejects(
      'weekly_reviews',
      {
        id: randomUUID(),
        user_id: alice.id,
        week_start: '2026-11-24',
        client_updated_at: SUNDAY_MORNING,
      },
      'weekly_reviews_week_start_monday',
    );
  });

  it('allows one weekly review per week', async () => {
    const { error } = await api(alice.client).from('weekly_reviews').insert({
      id: randomUUID(),
      user_id: alice.id,
      week_start: WEEK_1_MONDAY,
      client_updated_at: SUNDAY_MORNING,
    });
    expect(error?.code).toBe(UNIQUE_VIOLATION);
  });

  it('BR-27: pain details exist only when pain is reported', async () => {
    await rejects(
      'weekly_reviews',
      {
        id: randomUUID(),
        user_id: alice.id,
        week_start: '2026-11-30',
        pain_location: 'knee',
        client_updated_at: SUNDAY_MORNING,
      },
      'weekly_reviews_pain_details',
    );
  });

  it('BR-5: a completed session records when the user saved it', async () => {
    await rejects(
      'workout_sessions',
      {
        ...completedSession(alice, aliceRows.enrolmentId),
        completed_at: null,
        deleted_at: MONDAY_LATER,
      },
      'workout_sessions_saved_when_finished',
    );
  });

  it('a programme link is all or nothing, and carries a snapshot', async () => {
    const base = { ...completedSession(alice, aliceRows.enrolmentId), deleted_at: MONDAY_LATER };
    await rejects(
      'workout_sessions',
      { ...base, scheduled_date: null },
      'workout_sessions_programme_link',
    );
    await rejects(
      'workout_sessions',
      { ...base, prescription_snapshot: null },
      'workout_sessions_programme_snapshot',
    );
  });

  it('a set holds reps or a duration, not both', async () => {
    await rejects(
      'workout_sets',
      { ...setRow(aliceRows.workoutSessionId), set_number: 9, actual_duration_s: 45 },
      'workout_sets_one_measure',
    );
  });
});

describe('account deletion', () => {
  it('deleting the auth user leaves no rows in any of the 13 user tables', async () => {
    const carol = await createTestUser();
    const rows = await seedOwnRows(carol);
    await carol.remove();

    const db = await connectDb();
    try {
      const { rows: counts } = await db.query<{ remaining: string }>(
        `select
           (select count(*) from public.profiles where id = $1)
         + (select count(*) from public.user_goals where user_id = $1)
         + (select count(*) from public.user_equipment where user_id = $1)
         + (select count(*) from public.user_availability where user_id = $1)
         + (select count(*) from public.user_programmes where user_id = $1)
         + (select count(*) from public.schedule_overrides where user_programme_id = $2)
         + (select count(*) from public.prescription_overrides where user_programme_id = $2)
         + (select count(*) from public.workout_sessions where user_id = $1)
         + (select count(*) from public.workout_sets where workout_session_id = $3)
         + (select count(*) from public.running_sessions where user_id = $1)
         + (select count(*) from public.body_measurements where user_id = $1)
         + (select count(*) from public.fitness_tests where user_id = $1)
         + (select count(*) from public.weekly_reviews where user_id = $1)
           as remaining`,
        [carol.id, rows.enrolmentId, rows.workoutSessionId],
      );
      expect(Number(counts[0]?.remaining)).toBe(0);
    } finally {
      await db.end();
    }
  });
});

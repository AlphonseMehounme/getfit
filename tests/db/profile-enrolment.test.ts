import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  insertProgrammeFixture,
  type ProgrammeFixture,
  removeProgrammeFixture,
} from './content-fixtures';
import { anonClient, connectDb, createTestUser, type TestUser, withRollback } from './helpers';

// PRD §12 isolation: user B can never read or change user A's rows, and anon has no access.
// Tables of P1-03a (PRD §11 user tables; RLS owner only).

const PERMISSION_DENIED = '42501';
const WEEK_1_MONDAY = '2026-11-23';

// Isolation tests loop over tables with different columns, which the typed client can't express.
const api = (client: unknown) => client as SupabaseClient;

let alice: TestUser;
let bob: TestUser;
let content: ProgrammeFixture;
let aliceEnrolmentId: string;
let bobEnrolmentId: string;

/** How to find, change and forge one of Alice's rows in each table. */
interface TableCase {
  table: string;
  /** Filter selecting Alice's row. */
  aliceRow: () => Record<string, string | number>;
  /** A harmless change; must leave the row distinguishable from the original. */
  change: Record<string, unknown>;
  /** Bob tries to create a row owned by Alice. */
  forged: () => Record<string, unknown>;
  /** The table grants no delete at all, so the attempt fails outright instead of matching no rows. */
  deleteRevoked?: true;
}

const cases: TableCase[] = [
  {
    table: 'profiles',
    aliceRow: () => ({ id: alice.id }),
    change: { first_name: 'Changed' },
    forged: () => ({ id: alice.id }),
    deleteRevoked: true,
  },
  {
    table: 'user_goals',
    aliceRow: () => ({ user_id: alice.id, goal_type: 'improve_running' }),
    change: { status: 'achieved' },
    forged: () => ({ user_id: alice.id, goal_type: 'maintain' }),
  },
  {
    table: 'user_equipment',
    aliceRow: () => ({ user_id: alice.id, equipment: 'pull_up_bar' }),
    change: { equipment: 'bands' },
    forged: () => ({ user_id: alice.id, equipment: 'gym' }),
  },
  {
    table: 'user_availability',
    aliceRow: () => ({ user_id: alice.id, day_of_week: 1 }),
    change: { kind: 'rest' },
    forged: () => ({ user_id: alice.id, day_of_week: 2, kind: 'training' }),
  },
  {
    table: 'user_programmes',
    aliceRow: () => ({ id: aliceEnrolmentId }),
    change: { status: 'abandoned', ended_at: new Date(0).toISOString() },
    forged: () => ({
      user_id: alice.id,
      programme_id: content.programmeId,
      programme_version: 1,
      start_date: WEEK_1_MONDAY,
      start_mode: 'this_week',
      status: 'completed',
      ended_at: new Date(0).toISOString(),
    }),
  },
  {
    table: 'schedule_overrides',
    aliceRow: () => ({ user_programme_id: aliceEnrolmentId }),
    change: { reason: 'changed' },
    forged: () => ({
      user_programme_id: aliceEnrolmentId,
      programme_day_id: content.programmeDayId,
      original_date: WEEK_1_MONDAY,
      action: 'skipped',
    }),
  },
  {
    table: 'prescription_overrides',
    aliceRow: () => ({ user_programme_id: aliceEnrolmentId }),
    change: { target_reps: 9 },
    forged: () => ({
      user_programme_id: aliceEnrolmentId,
      template_exercise_id: content.templateExerciseId,
      from_week: 3,
      target_reps: 7,
    }),
  },
];

async function mustInsert(user: TestUser, table: string, row: Record<string, unknown>) {
  const { data, error } = await api(user.client).from(table).insert(row).select().single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data as Record<string, unknown>;
}

/** Each user fills every table through their own session, which also proves owners can write. */
async function seedOwnRows(user: TestUser): Promise<string> {
  await mustInsert(user, 'user_goals', { user_id: user.id, goal_type: 'improve_running' });
  await mustInsert(user, 'user_equipment', { user_id: user.id, equipment: 'pull_up_bar' });
  await mustInsert(user, 'user_availability', {
    user_id: user.id,
    day_of_week: 1,
    kind: 'training',
  });
  const enrolment = await mustInsert(user, 'user_programmes', {
    user_id: user.id,
    programme_id: content.programmeId,
    programme_version: 1,
    start_date: WEEK_1_MONDAY,
    start_mode: 'next_monday',
  });
  const enrolmentId = enrolment.id as string;
  await mustInsert(user, 'schedule_overrides', {
    user_programme_id: enrolmentId,
    programme_day_id: content.programmeDayId,
    original_date: WEEK_1_MONDAY,
    action: 'skipped',
  });
  await mustInsert(user, 'prescription_overrides', {
    user_programme_id: enrolmentId,
    template_exercise_id: content.templateExerciseId,
    from_week: 2,
    target_reps: 7,
  });
  return enrolmentId;
}

function whereRow(query: ReturnType<ReturnType<SupabaseClient['from']>['select']>, row: object) {
  return Object.entries(row).reduce((q, [column, value]) => q.eq(column, value), query);
}

async function readAs(user: TestUser, c: TableCase) {
  const { data, error } = await whereRow(api(user.client).from(c.table).select('*'), c.aliceRow());
  if (error) throw new Error(`${c.table}: ${error.message}`);
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
  [aliceEnrolmentId, bobEnrolmentId] = await Promise.all([seedOwnRows(alice), seedOwnRows(bob)]);
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
    expect(await readAs(alice, c)).toHaveLength(1);
  });

  it("another user cannot read the owner's row", async () => {
    expect(await readAs(bob, c)).toEqual([]);
  });

  it("another user cannot update the owner's row", async () => {
    const before = await readAs(alice, c);
    const { data, error } = await whereRow(
      api(bob.client).from(c.table).update(c.change).select() as never,
      c.aliceRow(),
    );
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(await readAs(alice, c)).toEqual(before);
  });

  it("another user cannot delete the owner's row", async () => {
    const { data, error } = await whereRow(
      api(bob.client).from(c.table).delete().select() as never,
      c.aliceRow(),
    );
    if (c.deleteRevoked) {
      expect(error?.code).toBe(PERMISSION_DENIED);
    } else {
      expect(error).toBeNull();
      expect(data).toEqual([]);
    }
    expect(await readAs(alice, c)).toHaveLength(1);
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

describe('policy definitions', () => {
  // Through the API, UPDATE and DELETE only reach rows the SELECT policy exposes, so a loosened
  // update or delete policy can hide behind a correct select policy. Check every policy directly.
  const expected: Record<string, string[]> = {
    profiles: ['SELECT', 'UPDATE'],
    user_goals: ['DELETE', 'INSERT', 'SELECT', 'UPDATE'],
    user_equipment: ['DELETE', 'INSERT', 'SELECT', 'UPDATE'],
    user_availability: ['DELETE', 'INSERT', 'SELECT', 'UPDATE'],
    user_programmes: ['DELETE', 'INSERT', 'SELECT', 'UPDATE'],
    schedule_overrides: ['DELETE', 'INSERT', 'SELECT', 'UPDATE'],
    prescription_overrides: ['DELETE', 'INSERT', 'SELECT', 'UPDATE'],
  };

  it('each table has exactly the expected owner policies, for authenticated only', async () => {
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
        /^\((id|user_id) = \( SELECT auth\.uid\(\) AS uid\)\)$|^owns_user_programme\(user_programme_id\)$/;
      expect(rows.filter((r) => !owner.test(r.clause))).toEqual([]);
    } finally {
      await db.end();
    }
  });
});

describe('forged ownership through updates', () => {
  it('a user cannot hand their own goal to someone else', async () => {
    const { error } = await api(bob.client)
      .from('user_goals')
      .update({ user_id: alice.id })
      .eq('user_id', bob.id);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it("a user cannot move their override onto someone else's enrolment", async () => {
    const { error } = await api(bob.client)
      .from('schedule_overrides')
      .update({ user_programme_id: aliceEnrolmentId })
      .eq('user_programme_id', bobEnrolmentId);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it('a user cannot delete their own profile through the API', async () => {
    const { error } = await api(bob.client).from('profiles').delete().eq('id', bob.id);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});

describe('profile created at sign-up (D29)', () => {
  const profileOf = async (user: TestUser) => {
    const { data, error } = await user.client
      .from('profiles')
      .select('locale, timezone, preferred_units, first_name')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return data;
  };

  it('uses the locale and time zone sent by the browser', async () => {
    const user = await createTestUser({ metadata: { locale: 'en', timezone: 'America/New_York' } });
    try {
      expect(await profileOf(user)).toEqual({
        locale: 'en',
        timezone: 'America/New_York',
        preferred_units: 'metric',
        first_name: null,
      });
    } finally {
      await user.remove();
    }
  });

  it('falls back to French and UTC for unknown values (D15)', async () => {
    const user = await createTestUser({ metadata: { locale: 'de', timezone: 'Mars/Olympus' } });
    try {
      expect(await profileOf(user)).toMatchObject({ locale: 'fr', timezone: 'UTC' });
    } finally {
      await user.remove();
    }
  });

  it('falls back to French and UTC without metadata', async () => {
    expect(await profileOf(alice)).toMatchObject({ locale: 'fr', timezone: 'UTC' });
  });

  it('rejects an unknown time zone on update', async () => {
    const { error } = await alice.client
      .from('profiles')
      .update({ timezone: 'Nowhere/Land' })
      .eq('id', alice.id);
    expect(error?.code).toBe('23514');
  });
});

describe('enrolment rules', () => {
  const enrol = (user: TestUser, values: Record<string, unknown> = {}) =>
    api(user.client)
      .from('user_programmes')
      .insert({
        user_id: user.id,
        programme_id: content.programmeId,
        programme_version: 1,
        start_date: WEEK_1_MONDAY,
        start_mode: 'next_monday',
        ...values,
      })
      .select('id')
      .single();

  it('rejects a second active enrolment', async () => {
    const { error } = await enrol(alice);
    expect(error?.code).toBe('23505');
  });

  it('accepts a finished enrolment next to the active one', async () => {
    const { data, error } = await enrol(alice, {
      status: 'completed',
      ended_at: new Date(0).toISOString(),
    });
    expect(error).toBeNull();
    await alice.client.from('user_programmes').delete().eq('id', data!.id);
  });

  it('BR-2: rejects a week-1 start that is not a Monday', async () => {
    const { error } = await enrol(alice, {
      start_date: '2026-11-24',
      status: 'abandoned',
      ended_at: new Date(0).toISOString(),
    });
    expect(error?.code).toBe('23514');
    expect(error?.message).toContain('user_programmes_start_on_monday');
  });

  it('rejects a programme version that does not exist', async () => {
    const { error } = await enrol(alice, {
      programme_version: 99,
      status: 'abandoned',
      ended_at: new Date(0).toISOString(),
    });
    expect(error?.code).toBe('23503');
  });
});

describe('override constraints', () => {
  const insertOverride = (values: Record<string, unknown>) =>
    withRollback(async (db) => {
      await db.query('delete from public.schedule_overrides where user_programme_id = $1', [
        aliceEnrolmentId,
      ]);
      await db.query(
        `insert into public.schedule_overrides (user_programme_id, programme_day_id, original_date, new_date, action)
         values ($1, $2, $3, $4, $5)`,
        [
          aliceEnrolmentId,
          content.programmeDayId,
          WEEK_1_MONDAY,
          values.new_date ?? null,
          values.action,
        ],
      );
    });

  it('BR-12: rejects a move into the next week', async () => {
    await expect(insertOverride({ action: 'moved', new_date: '2026-11-30' })).rejects.toMatchObject(
      { constraint: 'schedule_overrides_same_week' },
    );
  });

  it('BR-12: accepts a move within the Monday–Sunday week', async () => {
    await expect(
      insertOverride({ action: 'moved', new_date: '2026-11-29' }),
    ).resolves.toBeUndefined();
  });

  it('rejects a move without a new date, and a skip with one', async () => {
    await expect(insertOverride({ action: 'moved' })).rejects.toMatchObject({
      constraint: 'schedule_overrides_moved_has_date',
    });
    await expect(
      insertOverride({ action: 'skipped', new_date: '2026-11-25' }),
    ).rejects.toMatchObject({ constraint: 'schedule_overrides_moved_has_date' });
  });

  it('allows one override per programme day', async () => {
    const { error } = await api(alice.client).from('schedule_overrides').insert({
      user_programme_id: aliceEnrolmentId,
      programme_day_id: content.programmeDayId,
      original_date: WEEK_1_MONDAY,
      action: 'skipped',
    });
    expect(error?.code).toBe('23505');
  });

  it('BR-19: a prescription override holds exactly one target', async () => {
    const { error } = await api(alice.client).from('prescription_overrides').insert({
      user_programme_id: aliceEnrolmentId,
      template_exercise_id: content.templateExerciseId,
      from_week: 4,
      target_reps: 7,
      target_duration_s: 50,
    });
    expect(error?.code).toBe('23514');
  });
});

describe('account deletion', () => {
  it('deleting the auth user removes every row in these tables', async () => {
    const carol = await createTestUser();
    const enrolmentId = await seedOwnRows(carol);
    await carol.remove();

    const db = await connectDb();
    try {
      const { rows } = await db.query<{ remaining: string }>(
        `select
           (select count(*) from public.profiles where id = $1)
         + (select count(*) from public.user_goals where user_id = $1)
         + (select count(*) from public.user_equipment where user_id = $1)
         + (select count(*) from public.user_availability where user_id = $1)
         + (select count(*) from public.user_programmes where user_id = $1)
         + (select count(*) from public.schedule_overrides where user_programme_id = $2)
         + (select count(*) from public.prescription_overrides where user_programme_id = $2)
           as remaining`,
        [carol.id, enrolmentId],
      );
      expect(Number(rows[0]?.remaining)).toBe(0);
    } finally {
      await db.end();
    }
  });
});

import type { SupabaseClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CONTENT_TABLES, type ContentTable, fixtureSlug, insertExercise } from './content-fixtures';
import { anonClient, connectDb, createTestUser, type TestUser } from './helpers';

// PRD §12: content tables are readable by signed-in users and writable by nobody through the API.
const tables = Object.keys(CONTENT_TABLES) as ContentTable[];
const PERMISSION_DENIED = '42501';
const UNUSED_ID = '00000000-0000-4000-8000-000000000000';

// The write tests loop over tables with different key columns, which the typed client can't express.
const untyped = (client: unknown) => client as SupabaseClient;

let user: TestUser;
let fixtureId: string;
const fixture = fixtureSlug('fixture-visible');

beforeAll(async () => {
  user = await createTestUser();
  const db = await connectDb();
  try {
    fixtureId = await insertExercise(db, { slug: fixture });
  } finally {
    await db.end();
  }
});

afterAll(async () => {
  const db = await connectDb();
  try {
    await db.query('delete from public.exercises where slug = $1', [fixture]);
  } finally {
    await db.end();
  }
  await user?.remove();
});

describe('schema guards', () => {
  it('every table in the public schema has RLS enabled', async () => {
    const db = await connectDb();
    try {
      const { rows } = await db.query<{ tablename: string }>(
        `select tablename from pg_tables where schemaname = 'public' and not rowsecurity`,
      );
      expect(rows.map((r) => r.tablename)).toEqual([]);
    } finally {
      await db.end();
    }
  });

  it('API roles hold no write privileges on content tables, and anon holds none at all', async () => {
    const db = await connectDb();
    try {
      const { rows } = await db.query<{
        grantee: string;
        table_name: string;
        privilege_type: string;
      }>(
        `select grantee, table_name, privilege_type
           from information_schema.role_table_grants
          where table_schema = 'public'
            and table_name = any($1)
            and grantee in ('anon', 'authenticated')
            and not (grantee = 'authenticated' and privilege_type = 'SELECT')`,
        [tables],
      );
      expect(rows).toEqual([]);
    } finally {
      await db.end();
    }
  });
});

describe('authenticated user', () => {
  it.each(tables)('can read %s', async (table) => {
    const { error } = await user.client.from(table).select('*').limit(1);
    expect(error).toBeNull();
  });

  it('sees seeded exercise rows', async () => {
    const { data, error } = await user.client.from('exercises').select('id').eq('slug', fixture);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: fixtureId }]);
  });

  it.each(tables)('cannot insert into %s', async (table) => {
    const key = CONTENT_TABLES[table];
    const { error } = await untyped(user.client)
      .from(table)
      .insert({ [key]: UNUSED_ID } as never);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it.each(tables)('cannot update %s', async (table) => {
    const key = CONTENT_TABLES[table];
    const { error } = await untyped(user.client)
      .from(table)
      .update({ [key]: UNUSED_ID })
      .eq(key, fixtureId);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it.each(tables)('cannot delete from %s', async (table) => {
    const key = CONTENT_TABLES[table];
    const { error } = await untyped(user.client).from(table).delete().eq(key, fixtureId);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });

  it('left the fixture unchanged after the write attempts', async () => {
    const { data } = await user.client
      .from('exercises')
      .select('id, published')
      .eq('id', fixtureId);
    // The fixture is unpublished (content-fixtures.ts); the write attempts left that unchanged.
    expect(data).toEqual([{ id: fixtureId, published: false }]);
  });
});

describe('anonymous visitor', () => {
  it.each(tables)('cannot read %s', async (table) => {
    const { error } = await anonClient().from(table).select('*').limit(1);
    expect(error?.code).toBe(PERMISSION_DENIED);
  });
});

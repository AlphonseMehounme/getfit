import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import pg from 'pg';
import { inject } from 'vitest';
import type { Database } from '../../apps/web/server/db/types';

export type Db = SupabaseClient<Database>;

const noSession = { auth: { persistSession: false, autoRefreshToken: false } } as const;

/** A client with no session: the `anon` role. */
export function anonClient(): Db {
  const { apiUrl, publishableKey } = inject('supabase');
  return createClient<Database>(apiUrl, publishableKey, noSession);
}

/** Admin client for fixtures only (D29). Bypasses RLS, so never use it to assert access rules. */
function adminClient(): Db {
  const { apiUrl, secretKey } = inject('supabase');
  return createClient<Database>(apiUrl, secretKey, noSession);
}

export interface TestUser {
  id: string;
  /** Signed in as this user: the `authenticated` role, with RLS applied. */
  client: Db;
  remove: () => Promise<void>;
}

/** Creates a confirmed user with a random address and signs them in. */
export async function createTestUser(
  options: { metadata?: Record<string, unknown> } = {},
): Promise<TestUser> {
  const admin = adminClient();
  const email = `db-test-${randomUUID()}@example.test`;
  // Generated per run for a throwaway local user; never a fixed credential.
  const credential = randomUUID();

  const created = await admin.auth.admin.createUser({
    email,
    password: credential,
    email_confirm: true,
    ...(options.metadata ? { user_metadata: options.metadata } : {}),
  });
  if (created.error || !created.data.user) throw created.error ?? new Error('createUser failed');
  const id = created.data.user.id;

  const client = anonClient();
  const signedIn = await client.auth.signInWithPassword({ email, password: credential });
  if (signedIn.error) throw signedIn.error;

  return {
    id,
    client,
    remove: async () => {
      await client.auth.signOut();
      const deleted = await admin.auth.admin.deleteUser(id);
      if (deleted.error) throw deleted.error;
    },
  };
}

/** Direct Postgres connection as the database owner, for constraint tests and fixtures. */
export async function connectDb(): Promise<pg.Client> {
  const client = new pg.Client({ connectionString: inject('supabase').dbUrl });
  await client.connect();
  return client;
}

/** Runs `fn` inside a transaction that is always rolled back, so constraint tests leave no rows. */
export async function withRollback<T>(fn: (db: pg.Client) => Promise<T>): Promise<T> {
  const db = await connectDb();
  try {
    await db.query('begin');
    return await fn(db);
  } finally {
    await db.query('rollback').catch(() => undefined);
    await db.end();
  }
}

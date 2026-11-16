import { randomUUID } from 'node:crypto';
import { afterAll, describe, expect, it } from 'vitest';
import { getAccount } from '../../apps/web/server/services/account';
import {
  confirmEmail,
  getCurrentUser,
  signIn,
  signOut,
  signUp,
} from '../../apps/web/server/services/auth';
import { anonClient, connectDb, createTestUser } from './helpers';

// Integration tests for server/services/auth.ts against local Supabase Auth (PRD §6.1, D29).
const REDIRECT = 'http://localhost:3100/auth/confirm';
const created: string[] = [];

const newEmail = () => {
  const email = `svc-test-${randomUUID()}@example.test`;
  created.push(email);
  return email;
};
const newPassword = () => `pw-${randomUUID()}`;

async function query<T>(sql: string, params: unknown[]): Promise<T[]> {
  const db = await connectDb();
  try {
    return (await db.query(sql, params)).rows as T[];
  } finally {
    await db.end();
  }
}

/** Stands in for clicking the email link, which the E2E suite covers. */
const markConfirmed = (email: string) =>
  query('update auth.users set email_confirmed_at = now() where email = $1', [email]);

afterAll(async () => {
  await query('delete from auth.users where email = any($1)', [created]);
});

describe('signUp', () => {
  it('creates an unconfirmed user whose profile has the browser language and zone (D29)', async () => {
    const email = newEmail();
    const result = await signUp(
      anonClient(),
      { email, password: newPassword(), locale: 'en', timezone: 'Europe/Paris' },
      REDIRECT,
    );
    expect(result).toEqual({ ok: true });

    const [row] = await query<{ confirmed: boolean; locale: string; timezone: string }>(
      `select u.email_confirmed_at is not null as confirmed, p.locale, p.timezone
         from auth.users u join public.profiles p on p.id = u.id where u.email = $1`,
      [email],
    );
    expect(row).toEqual({ confirmed: false, locale: 'en', timezone: 'Europe/Paris' });
  });

  it('gives the same answer for an email that is already registered', async () => {
    const email = newEmail();
    const input = { email, password: newPassword() };
    expect(await signUp(anonClient(), input, REDIRECT)).toEqual({ ok: true });
    // Supabase allows one email per address per second (config.toml `max_frequency`).
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    expect(await signUp(anonClient(), input, REDIRECT)).toEqual({ ok: true });
  });

  it('rejects invalid input on the server too', async () => {
    const result = await signUp(anonClient(), { email: 'nope', password: 'short' }, REDIRECT);
    expect(result).toEqual({ ok: false, error: 'invalidInput' });
  });
});

describe('signIn and signOut', () => {
  it('refuses to sign in before the email is confirmed', async () => {
    const email = newEmail();
    const password = newPassword();
    await signUp(anonClient(), { email, password }, REDIRECT);
    expect(await signIn(anonClient(), { email, password })).toEqual({
      ok: false,
      error: 'emailNotConfirmed',
    });
  });

  it('reports a wrong password with the generic message', async () => {
    const user = await createTestUser();
    try {
      const [row] = await query<{ email: string }>('select email from auth.users where id = $1', [
        user.id,
      ]);
      expect(await signIn(anonClient(), { email: row!.email, password: 'wrong-password' })).toEqual(
        { ok: false, error: 'invalidCredentials' },
      );
    } finally {
      await user.remove();
    }
  });

  it('signs in a confirmed user, reads their account, and signs out', async () => {
    const email = newEmail();
    const password = newPassword();
    await signUp(
      anonClient(),
      { email, password, locale: 'fr', timezone: 'Pacific/Auckland' },
      REDIRECT,
    );
    await markConfirmed(email);

    const client = anonClient();
    // Emails are normalised, so a differently cased address signs in to the same account.
    expect(await signIn(client, { email: email.toUpperCase(), password })).toEqual({ ok: true });
    expect(await getCurrentUser(client)).toMatchObject({ email });
    expect(await getAccount(client)).toEqual({ email, locale: 'fr', timezone: 'Pacific/Auckland' });

    expect(await signOut(client)).toEqual({ ok: true });
    expect(await getCurrentUser(client)).toBeNull();
    expect(await getAccount(client)).toBeNull();
  });
});

describe('confirmEmail', () => {
  it.each([undefined, '', 'x'.repeat(513)])('rejects a malformed token %#', async (token) => {
    expect(await confirmEmail(anonClient(), token)).toEqual({ ok: false, error: 'invalidLink' });
  });

  it('rejects a token that Supabase does not know', async () => {
    expect(await confirmEmail(anonClient(), randomUUID())).toEqual({
      ok: false,
      error: 'invalidLink',
    });
  });
});

import type { DbClient } from '@/server/db/client';
import { loginSchema, signUpSchema } from '@/lib/validation/auth';
import { type AuthErrorKey, toAuthErrorKey } from './auth-errors';

export type AuthResult = { ok: true } | { ok: false; error: AuthErrorKey };

const OK: AuthResult = { ok: true };

/** Logs the error code only: never the email address or any other personal field (AGENTS §12). */
function fail(operation: string, error: { code?: string; status?: number }): AuthResult {
  const key = toAuthErrorKey(error);
  if (key === 'unexpected') console.error(`[auth] ${operation} failed`, error.code ?? error.status);
  return { ok: false, error: key };
}

/**
 * Creates an account and sends the confirmation email (PRD §6.1).
 * The result is the same whether or not the email is already registered, so it can't be used to probe accounts.
 */
export async function signUp(
  client: DbClient,
  input: unknown,
  emailRedirectTo: string,
): Promise<AuthResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalidInput' };
  const { email, password, locale, timezone } = parsed.data;

  const { error } = await client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo, data: { locale, timezone } },
  });
  if (error && error.code !== 'user_already_exists') return fail('sign-up', error);
  return OK;
}

export async function signIn(client: DbClient, input: unknown): Promise<AuthResult> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalidInput' };

  const { error } = await client.auth.signInWithPassword(parsed.data);
  return error ? fail('sign-in', error) : OK;
}

/** Signs out this device only; other devices keep their sessions. */
export async function signOut(client: DbClient): Promise<AuthResult> {
  const { error } = await client.auth.signOut({ scope: 'local' });
  return error ? fail('sign-out', error) : OK;
}

/** Verifies the link from the confirmation email, which signs the user in on this device. */
export async function confirmEmail(client: DbClient, tokenHash: unknown): Promise<AuthResult> {
  if (typeof tokenHash !== 'string' || tokenHash.length === 0 || tokenHash.length > 512) {
    return { ok: false, error: 'invalidLink' };
  }
  const { error } = await client.auth.verifyOtp({ type: 'email', token_hash: tokenHash });
  return error ? fail('confirm', error) : OK;
}

export interface CurrentUser {
  id: string;
  email: string | null;
}

/** The signed-in user, verified with Supabase Auth (not just read from the cookie). */
export async function getCurrentUser(client: DbClient): Promise<CurrentUser | null> {
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

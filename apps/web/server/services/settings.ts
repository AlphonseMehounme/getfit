import type { Locale } from '@/lib/i18n/config';
import type { Theme } from '@/lib/theme';
import { preferencesSchema } from '@/lib/validation/settings';
import type { DbClient } from '@/server/db/client';
import { findProfileSettings, updateProfile } from '@/server/repositories/profiles';
import { getCurrentUser } from './auth';

// D35: Profile preferences. D15 / ADR 0003: the language is the account's (`profiles.locale`), and the request
// cookie follows it. D56: the theme is only validated here; the device keeps it.

export type SavePreferencesResult =
  | { ok: true; locale: Locale; theme: Theme }
  | { ok: false; error: 'invalid_input' | 'not_signed_in' };

export async function savePreferences(
  client: DbClient,
  input: unknown,
): Promise<SavePreferencesResult> {
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  const user = await getCurrentUser(client);
  if (!user) return { ok: false, error: 'not_signed_in' };
  // The locale is an enum, so the database has no check left to refuse it.
  await updateProfile(client, user.id, { locale: parsed.data.locale });
  return { ok: true, ...parsed.data };
}

/** The signed-in user's language, to set the request cookie after sign-in (ADR 0003). Null when signed out. */
export async function getProfileLocale(client: DbClient): Promise<Locale | null> {
  const user = await getCurrentUser(client);
  if (!user) return null;
  return (await findProfileSettings(client, user.id))?.locale ?? null;
}

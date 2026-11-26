import type { DbClient } from '@/server/db/client';
import { findProfileSettings } from '@/server/repositories/profiles';
import { getCurrentUser } from './auth';

export interface Account {
  /** The device's offline store is per user (D89). */
  id: string;
  email: string | null;
  locale: 'fr' | 'en';
  timezone: string;
}

/** What the Profile page shows about the account. Null when nobody is signed in. */
export async function getAccount(client: DbClient): Promise<Account | null> {
  const user = await getCurrentUser(client);
  if (!user) return null;
  const profile = await findProfileSettings(client, user.id);
  if (!profile) throw new Error('profile missing for signed-in user');
  return { id: user.id, email: user.email, locale: profile.locale, timezone: profile.timezone };
}

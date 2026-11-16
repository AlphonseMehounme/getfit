import type { DbClient } from '@/server/db/client';
import type { Database } from '@/server/db/types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ProfileSettings = Pick<ProfileRow, 'locale' | 'timezone'>;

/** Reads the signed-in user's own profile; RLS returns nothing for anyone else's. */
export async function findProfileSettings(
  client: DbClient,
  userId: string,
): Promise<ProfileSettings | null> {
  const { data, error } = await client
    .from('profiles')
    .select('locale, timezone')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(`profiles: ${error.code}`);
  return data;
}

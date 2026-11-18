import type { DbClient } from '@/server/db/client';
import type { Database } from '@/server/db/types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ProfileSettings = Pick<ProfileRow, 'locale' | 'timezone' | 'preferred_units'>;

/** Reads the signed-in user's own profile; RLS returns nothing for anyone else's. */
export async function findProfileSettings(
  client: DbClient,
  userId: string,
): Promise<ProfileSettings | null> {
  const { data, error } = await client
    .from('profiles')
    .select('locale, timezone, preferred_units')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(`profiles: ${error.code}`);
  return data;
}

type EquipmentType = Database['public']['Enums']['equipment_type'];

/** D40: the equipment the user recorded in onboarding or Settings (empty when none). */
export async function findUserEquipment(
  client: DbClient,
  userId: string,
): Promise<EquipmentType[]> {
  const { data, error } = await client
    .from('user_equipment')
    .select('equipment')
    .eq('user_id', userId);
  if (error) throw new Error(`user_equipment: ${error.code}`);
  return data.map((row) => row.equipment);
}

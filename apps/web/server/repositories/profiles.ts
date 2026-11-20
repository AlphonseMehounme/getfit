import type { DbClient } from '@/server/db/client';
import type { Database } from '@/server/db/types';

type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type ProfileSettings = Pick<
  ProfileRow,
  'locale' | 'timezone' | 'preferred_units' | 'first_name'
>;

/** Reads the signed-in user's own profile; RLS returns nothing for anyone else's. */
export async function findProfileSettings(
  client: DbClient,
  userId: string,
): Promise<ProfileSettings | null> {
  const { data, error } = await client
    .from('profiles')
    .select('locale, timezone, preferred_units, first_name')
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

export type OnboardingProfile = Pick<
  ProfileRow,
  | 'first_name'
  | 'birth_year'
  | 'height_cm'
  | 'preferred_units'
  | 'locale'
  | 'timezone'
  | 'experience_level'
  | 'preferred_duration_min'
  | 'onboarding_completed_at'
>;

/** PRD §6.2: the profile's onboarding answers. */
export async function findOnboardingProfile(
  client: DbClient,
  userId: string,
): Promise<OnboardingProfile | null> {
  const { data, error } = await client
    .from('profiles')
    .select(
      'first_name, birth_year, height_cm, preferred_units, locale, timezone, experience_level, preferred_duration_min, onboarding_completed_at',
    )
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(`profiles: ${error.code}`);
  return data;
}

type ProfileUpdate = Pick<
  Database['public']['Tables']['profiles']['Update'],
  | 'first_name'
  | 'birth_year'
  | 'height_cm'
  | 'preferred_units'
  | 'timezone'
  | 'experience_level'
  | 'preferred_duration_min'
  | 'locale'
>;

/** Returns false when the database refused a value (a check constraint, e.g. an unknown time zone). */
export async function updateProfile(
  client: DbClient,
  userId: string,
  fields: ProfileUpdate,
): Promise<{ ok: boolean }> {
  const { error } = await client.from('profiles').update(fields).eq('id', userId);
  if (error?.code === '23514') return { ok: false };
  if (error) throw new Error(`profiles: ${error.code}`);
  return { ok: true };
}

/** D53: sets `onboarding_completed_at` only the first time; true when this call set it. */
export async function markOnboardingCompleted(
  client: DbClient,
  userId: string,
  at: Date,
): Promise<boolean> {
  const { data, error } = await client
    .from('profiles')
    .update({ onboarding_completed_at: at.toISOString() })
    .eq('id', userId)
    .is('onboarding_completed_at', null)
    .select('id');
  if (error) throw new Error(`profiles: ${error.code}`);
  return data.length > 0;
}

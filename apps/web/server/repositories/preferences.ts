import type { Availability, AvailabilityKind, IsoWeekday } from '@getfit/domain';
import type { DbClient } from '@/server/db/client';
import type { Database } from '@/server/db/types';

// Onboarding steps 2, 4 and 5 (PRD §6.2), with the user's session (RLS). Saving a step replaces its answers: the new
// rows are written first and the others deleted after, so a failure in between leaves a superset, never nothing.

type Enums = Database['public']['Enums'];
export type GoalType = Enums['goal_type'];
export type EquipmentType = Enums['equipment_type'];

const fail = (table: string, code: string | undefined): never => {
  throw new Error(`${table}: ${code}`);
};

/** PostgREST's list syntax for `not in`; enum values never contain commas or parentheses. */
const list = (values: readonly (string | number)[]) => `(${values.join(',')})`;

export async function findGoals(client: DbClient, userId: string): Promise<GoalType[]> {
  const { data, error } = await client
    .from('user_goals')
    .select('goal_type')
    .eq('user_id', userId)
    .eq('status', 'active');
  if (error) fail('user_goals', error.code);
  return data!.map((row) => row.goal_type);
}

/** Active goals become exactly `goals`. Goals are answers, not history, so the others are deleted. */
export async function replaceGoals(client: DbClient, userId: string, goals: readonly GoalType[]) {
  const current = new Set(await findGoals(client, userId));
  const added = goals.filter((goal) => !current.has(goal));
  if (added.length > 0) {
    const { error } = await client
      .from('user_goals')
      .insert(added.map((goal_type) => ({ user_id: userId, goal_type })));
    // A concurrent save added the same goal first (user_goals_one_active_per_type): the result is the same.
    if (error && error.code !== '23505') fail('user_goals', error.code);
  }
  let removed = client.from('user_goals').delete().eq('user_id', userId).eq('status', 'active');
  if (goals.length > 0) removed = removed.not('goal_type', 'in', list(goals));
  const { error } = await removed;
  if (error) fail('user_goals', error.code);
}

export async function replaceEquipment(
  client: DbClient,
  userId: string,
  equipment: readonly EquipmentType[],
) {
  if (equipment.length > 0) {
    const { error } = await client.from('user_equipment').upsert(
      equipment.map((item) => ({ user_id: userId, equipment: item })),
      { onConflict: 'user_id,equipment', ignoreDuplicates: true },
    );
    if (error) fail('user_equipment', error.code);
  }
  let removed = client.from('user_equipment').delete().eq('user_id', userId);
  if (equipment.length > 0) removed = removed.not('equipment', 'in', list(equipment));
  const { error } = await removed;
  if (error) fail('user_equipment', error.code);
}

export async function findAvailability(client: DbClient, userId: string): Promise<Availability> {
  const { data, error } = await client
    .from('user_availability')
    .select('day_of_week, kind')
    .eq('user_id', userId);
  if (error) fail('user_availability', error.code);
  return Object.fromEntries(
    data!.map((row) => [row.day_of_week as IsoWeekday, row.kind as AvailabilityKind]),
  );
}

/** D36: stored as given; it never moves a session. */
export async function replaceAvailability(client: DbClient, userId: string, days: Availability) {
  const rows = (Object.entries(days) as [`${IsoWeekday}`, AvailabilityKind][]).map(
    ([day, kind]) => ({ user_id: userId, day_of_week: Number(day), kind }),
  );
  if (rows.length > 0) {
    const { error } = await client
      .from('user_availability')
      .upsert(rows, { onConflict: 'user_id,day_of_week' });
    if (error) fail('user_availability', error.code);
  }
  let removed = client.from('user_availability').delete().eq('user_id', userId);
  if (rows.length > 0)
    removed = removed.not('day_of_week', 'in', list(rows.map((r) => r.day_of_week)));
  const { error } = await removed;
  if (error) fail('user_availability', error.code);
}

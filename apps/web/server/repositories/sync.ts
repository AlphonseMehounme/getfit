import type { Json } from '@/server/db/types';
import type { DbClient } from '@/server/db/client';

// P4-04: the sync ledger and the writes kept apart (D91, D103). RLS: the user's own rows only.

const fail = (table: string, code: string | undefined): never => {
  throw new Error(`${table}: ${code ?? 'unknown'}`);
};

export type SettledStatus = 'applied' | 'conflict' | 'refused';

/**
 * Claims a write's ID before it is applied. `new` the first time; `retry` when an earlier attempt claimed it and
 * never settled (it failed), so it is applied again; `settled` when it was already applied or answered.
 */
export async function claimWrite(
  client: DbClient,
  write: { id: string; userId: string; kind: string },
): Promise<'new' | 'retry' | 'settled'> {
  const { error } = await client
    .from('sync_writes')
    .insert({ id: write.id, user_id: write.userId, kind: write.kind, status: 'pending' });
  if (!error) return 'new';
  if (error.code !== '23505') fail('sync_writes', error.code);
  const { data, error: readError } = await client
    .from('sync_writes')
    .select('status')
    .eq('id', write.id)
    .maybeSingle();
  if (readError) fail('sync_writes', readError.code);
  // Another user's write with this ID is invisible (RLS): it is treated as already answered, never applied.
  return data?.status === 'pending' ? 'retry' : 'settled';
}

export async function settleWrite(
  client: DbClient,
  id: string,
  status: SettledStatus,
): Promise<void> {
  const { error } = await client.from('sync_writes').update({ status }).eq('id', id);
  if (error) fail('sync_writes', error.code);
}

export type RecordType = 'workout_session' | 'workout_set' | 'running_session';

export interface KeptWrite {
  userId: string;
  writeId: string;
  kind: string;
  status: 'conflict' | 'refused';
  reason: string | null;
  record: { type: RecordType; id: string } | null;
  payload: unknown;
  clientUpdatedAt: Date;
}

/** D91 / D103: a version that was not applied, kept with its payload. */
export async function insertKeptWrite(client: DbClient, kept: KeptWrite): Promise<void> {
  const { error } = await client.from('sync_conflicts').insert({
    user_id: kept.userId,
    write_id: kept.writeId,
    kind: kept.kind,
    status: kept.status,
    reason: kept.reason,
    record_type: kept.record?.type ?? null,
    record_id: kept.record?.id ?? null,
    payload: (kept.payload ?? null) as Json,
    client_updated_at: kept.clientUpdatedAt.toISOString(),
  });
  if (error) fail('sync_conflicts', error.code);
}

/** A stored row's version, for D91. */
export interface RecordVersion {
  clientUpdatedAt: Date;
  deletedAt: Date | null;
}

export async function findSetVersion(client: DbClient, id: string): Promise<RecordVersion | null> {
  const { data, error } = await client
    .from('workout_sets')
    .select('client_updated_at')
    .eq('id', id)
    .maybeSingle();
  if (error) fail('workout_sets', error.code);
  return data ? { clientUpdatedAt: new Date(data.client_updated_at), deletedAt: null } : null;
}

export interface SetSlot {
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  side: 'left' | 'right' | 'both';
}

/** The set holding a slot (the table's unique key), with its values, so a losing version can be kept. */
export async function findSetAtSlot(
  client: DbClient,
  slot: SetSlot,
): Promise<{ id: string; clientUpdatedAt: Date; row: Json } | null> {
  const { data, error } = await client
    .from('workout_sets')
    .select('*')
    .eq('workout_session_id', slot.sessionId)
    .eq('exercise_id', slot.exerciseId)
    .eq('set_number', slot.setNumber)
    .eq('side', slot.side)
    .maybeSingle();
  if (error) fail('workout_sets', error.code);
  return data
    ? { id: data.id, clientUpdatedAt: new Date(data.client_updated_at), row: data as Json }
    : null;
}

export async function findRunVersion(client: DbClient, id: string): Promise<RecordVersion | null> {
  const { data, error } = await client
    .from('running_sessions')
    .select('client_updated_at, deleted_at')
    .eq('id', id)
    .maybeSingle();
  if (error) fail('running_sessions', error.code);
  return data
    ? {
        clientUpdatedAt: new Date(data.client_updated_at),
        deletedAt: data.deleted_at ? new Date(data.deleted_at) : null,
      }
    : null;
}

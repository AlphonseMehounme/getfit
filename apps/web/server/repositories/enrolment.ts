import { type Enrolment, type Instant, type LocalDate, parseLocalDate } from '@getfit/domain';
import type { DbClient } from '@/server/db/client';

// user_programmes (PRD §11): one active enrolment per user, enforced by `user_programmes_one_active`.

export interface EnrolmentRecord extends Enrolment {
  id: string;
  programmeId: string;
  programmeVersion: number;
}

const COLUMNS = 'id, programme_id, programme_version, start_date, start_mode, created_at';

type Row = {
  id: string;
  programme_id: string;
  programme_version: number;
  start_date: string;
  start_mode: Enrolment['startMode'];
  created_at: string;
};

const toRecord = (row: Row): EnrolmentRecord => ({
  id: row.id,
  programmeId: row.programme_id,
  programmeVersion: row.programme_version,
  startDate: parseLocalDate(row.start_date),
  startMode: row.start_mode,
  enrolledAt: new Date(row.created_at),
});

export async function findActiveEnrolment(
  client: DbClient,
  userId: string,
): Promise<EnrolmentRecord | null> {
  const { data, error } = await client
    .from('user_programmes')
    .select(COLUMNS)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw new Error(`user_programmes: ${error.code}`);
  return data ? toRecord(data) : null;
}

export interface NewEnrolment {
  userId: string;
  programmeId: string;
  programmeVersion: number;
  startDate: LocalDate;
  startMode: Enrolment['startMode'];
  /** The injected `now` (ADR 0002), so BR-2's "days already past" follows the app clock. */
  enrolledAt: Instant;
}

export type InsertEnrolmentResult = { ok: true; enrolment: EnrolmentRecord } | { ok: false };

/** `{ ok: false }` when another active enrolment already exists (unique index, error 23505). */
export async function insertEnrolment(
  client: DbClient,
  input: NewEnrolment,
): Promise<InsertEnrolmentResult> {
  const { data, error } = await client
    .from('user_programmes')
    .insert({
      user_id: input.userId,
      programme_id: input.programmeId,
      programme_version: input.programmeVersion,
      start_date: input.startDate,
      start_mode: input.startMode,
      created_at: input.enrolledAt.toISOString(),
    })
    .select(COLUMNS)
    .single();
  if (error?.code === '23505') return { ok: false };
  if (error) throw new Error(`user_programmes: ${error.code}`);
  return { ok: true, enrolment: toRecord(data) };
}

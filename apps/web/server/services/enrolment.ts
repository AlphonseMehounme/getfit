import { type Clock, localDateAt, week1Monday } from '@getfit/domain';
import { z } from 'zod';
import { type Track, track } from '@/lib/observability/analytics';
import { LAUNCH_PROGRAMME_SLUG } from '@/server/config/programme';
import type { DbClient } from '@/server/db/client';
import {
  type EnrolmentRecord,
  findActiveEnrolment,
  insertEnrolment,
} from '@/server/repositories/enrolment';
import { findProgramme } from '@/server/repositories/programme';
import { findProfileSettings } from '@/server/repositories/profiles';
import { getCurrentUser } from './auth';

// D20: the Phase 1 "Start programme" step (Start Monday / Start this week, BR-2), wrapped by onboarding in Phase 2.

export const startProgrammeSchema = z.strictObject({
  mode: z.enum(['next_monday', 'this_week']),
});

export type StartProgrammeError =
  'invalid_input' | 'not_signed_in' | 'already_enrolled' | 'programme_unavailable';

export type StartProgrammeResult =
  | { ok: true; enrolment: EnrolmentRecord; created: boolean }
  | { ok: false; error: StartProgrammeError };

/** Starting again is a no-op that returns the current enrolment; another programme's enrolment is refused. */
function existingResult(enrolment: EnrolmentRecord, programmeId: string): StartProgrammeResult {
  return enrolment.programmeId === programmeId
    ? { ok: true, enrolment, created: false }
    : { ok: false, error: 'already_enrolled' };
}

export async function startProgramme(
  client: DbClient,
  input: unknown,
  clock: Clock,
  trackEvent: Track = track,
): Promise<StartProgrammeResult> {
  const parsed = startProgrammeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };

  const user = await getCurrentUser(client);
  if (!user) return { ok: false, error: 'not_signed_in' };
  const profile = await findProfileSettings(client, user.id);
  if (!profile) throw new Error('profile missing for signed-in user');

  const programme = await findProgramme(client, { slug: LAUNCH_PROGRAMME_SLUG }, profile.locale);
  if (!programme) return { ok: false, error: 'programme_unavailable' };

  const current = await findActiveEnrolment(client, user.id);
  if (current) return existingResult(current, programme.id);

  const now = clock.now();
  const inserted = await insertEnrolment(client, {
    userId: user.id,
    programmeId: programme.id,
    programmeVersion: programme.version,
    // BR-1 / BR-2: "today" is the date in the user's time zone.
    startDate: week1Monday(localDateAt(now, profile.timezone), parsed.data.mode),
    startMode: parsed.data.mode,
    enrolledAt: now,
  });
  if (!inserted.ok) {
    // Another request enrolled first (unique active index): answer as if it had happened before this one.
    const winner = await findActiveEnrolment(client, user.id);
    if (!winner) throw new Error('user_programmes: conflict without an active enrolment');
    return existingResult(winner, programme.id);
  }

  await trackEvent(
    {
      name: 'programme_started',
      properties: {
        programme_id: programme.id,
        user_programme_id: inserted.enrolment.id,
        start_mode: inserted.enrolment.startMode,
      },
    },
    user.id,
  );
  return { ok: true, enrolment: inserted.enrolment, created: true };
}

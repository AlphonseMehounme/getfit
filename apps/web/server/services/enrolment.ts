import { type Clock, type LocalDate, localDateAt, week1Monday } from '@getfit/domain';
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
import { findOnboardingProfile, findProfileSettings } from '@/server/repositories/profiles';
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

export type StartOptions =
  | { kind: 'enrolled' }
  /** D20 / PRD §6.2: not enrolled and onboarding not finished: the steps come first. */
  | { kind: 'onboarding' }
  | {
      kind: 'options';
      programmeTitle: string;
      programmeDescription: string;
      today: LocalDate;
      /** BR-2: week 1 starts on the Monday on or after today… */
      nextMonday: LocalDate;
      /** …or on this week's Monday, with the days already past not scheduled. Equal to nextMonday on a Monday. */
      thisWeekMonday: LocalDate;
    };

/** What the Start step offers. Null when nobody is signed in. */
export async function getStartOptions(
  client: DbClient,
  clock: Clock,
): Promise<StartOptions | null> {
  const user = await getCurrentUser(client);
  if (!user) return null;
  const profile = await findProfileSettings(client, user.id);
  if (!profile) throw new Error('profile missing for signed-in user');
  // An enrolment wins, so an account enrolled before onboarding existed is never sent back to it.
  if (await findActiveEnrolment(client, user.id)) return { kind: 'enrolled' };
  const onboarding = await findOnboardingProfile(client, user.id);
  if (!onboarding?.onboarding_completed_at) return { kind: 'onboarding' };

  const programme = await findProgramme(client, { slug: LAUNCH_PROGRAMME_SLUG }, profile.locale);
  if (!programme) throw new Error('content: launch programme not published');
  const today = localDateAt(clock.now(), profile.timezone);
  return {
    kind: 'options',
    programmeTitle: programme.title,
    programmeDescription: programme.description,
    today,
    nextMonday: week1Monday(today, 'next_monday'),
    thisWeekMonday: week1Monday(today, 'this_week'),
  };
}

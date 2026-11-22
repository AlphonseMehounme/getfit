import {
  addDays,
  buildWeek,
  type CheckIn,
  chooseProgression,
  type Clock,
  compareLocalDates,
  isLocalDate,
  isoWeekday,
  localDateAt,
  localDayBounds,
  openReviewWeek,
  progressionEligible,
  recommend,
  reviewState,
  weekInsights,
  weeklyAdherence,
  weekSummary,
  weightToKg,
} from '@getfit/domain';
import { type Track, track } from '@/lib/observability/analytics';
import { reviewInputSchema } from '@/lib/validation/review';
import type { DbClient } from '@/server/db/client';
import {
  findReview,
  findReviewWeights,
  findWeekActivity,
  type ReviewRecord,
  softDeleteMeasurement,
  upsertReview,
  upsertReviewWeight,
} from '@/server/repositories/reviews';
import { describeSuggestion, longRunCeiling, withdrawOnPain } from './progression';
import { loadSchedule, type ScheduleContext } from './schedule';

// PRD §6.9 weekly review: one per programme week, open from Sunday 18:00 to Wednesday (D68). Everything shown is
// computed by the domain from logged data and the check-in (D64, D69, D71, D76); nothing is edited (BR-25). Pain
// always leads to the cautious path with no progression (BR-27) and never leaves the server (D72, AGENTS §12).

const NO_CHECK_IN: CheckIn = {
  fatigue: null,
  soreness: null,
  sleep: null,
  motivation: null,
  pain: false,
  painArea: null,
  painNote: null,
};

const checkInOf = (r: ReviewRecord): CheckIn => ({
  fatigue: r.fatigue,
  soreness: r.soreness,
  sleep: r.sleep,
  motivation: r.motivation,
  pain: r.pain,
  painArea: r.painArea,
  painNote: r.painNote,
});

/** A programme week that has started, by its Monday (D68: every started week has a review). */
function programmeWeek(context: ScheduleContext, weekStart: string) {
  if (!isLocalDate(weekStart) || isoWeekday(weekStart) !== 1) return null;
  const today = localDateAt(context.now, context.profile.timezone);
  if (compareLocalDates(weekStart, today) > 0) return null;
  const week = buildWeek(context.scheduleInput, weekStart, context.now);
  return week.weekNumber === null ? null : { ...week, weekNumber: week.weekNumber };
}

/** The week's summary, insights, suggestion and recommendation, for a check-in (D64). */
async function computeReview(
  client: DbClient,
  context: ScheduleContext,
  week: NonNullable<ReturnType<typeof programmeWeek>>,
  checkIn: CheckIn,
  reviewWeight: ReviewRecord['weight'],
) {
  const zone = context.profile.timezone;
  const sunday = addDays(week.monday, 6);
  const previousMonday = addDays(week.monday, -7);
  const hasPrevious = week.weekNumber > 1;
  const [activity, previousActivity, weight] = await Promise.all([
    findWeekActivity(client, context.userId, context.enrolment.id, week.monday, sunday),
    hasPrevious
      ? findWeekActivity(
          client,
          context.userId,
          context.enrolment.id,
          previousMonday,
          addDays(previousMonday, 6),
        )
      : null,
    findReviewWeights(client, context.userId, {
      start: localDayBounds(week.monday, zone).start,
      end: localDayBounds(sunday, zone).end,
      reviewWeight,
    }),
  ]);
  const sessions = week.days.flatMap((d) => d.sessions);
  const summary = weekSummary({ sessions, ...activity, weight });
  const previous = previousActivity
    ? weekSummary({
        sessions: buildWeek(context.scheduleInput, previousMonday, context.now).days.flatMap(
          (d) => d.sessions,
        ),
        ...previousActivity,
        weight: { latestKg: null, previousKg: null },
      })
    : null;
  const insights = weekInsights(summary, previous, checkIn);
  const eligibility = progressionEligible({
    weekNumber: week.weekNumber,
    adherence: weeklyAdherence(sessions),
    averageRpe: summary.averageRpe,
    checkIn,
  });
  const suggestion = eligibility.eligible
    ? chooseProgression({
        weekNumber: week.weekNumber,
        workouts: activity.workouts,
        runs: activity.runs,
        // D71: the ceiling after any accepted change, so the next +10% builds on it.
        ceilingM: longRunCeiling(context.programme, week.weekNumber, context.prescriptionOverrides),
      })
    : null;
  return {
    summary,
    insights,
    eligibility,
    suggestion,
    recommendation: recommend({ checkIn, summary, insights, suggestion }),
  };
}

/** A week's review as the review screen shows it (P3-09). */
export async function getReview(client: DbClient, weekStart: string, clock: Clock) {
  const context = await loadSchedule(client, clock);
  if (context === 'not_signed_in') return null;
  if (context === 'not_enrolled') return { kind: 'not_enrolled' as const };
  const week = programmeWeek(context, weekStart);
  if (!week) return { kind: 'not_a_week' as const };
  const stored = await findReview(client, context.userId, week.monday);
  const computed = await computeReview(
    client,
    context,
    week,
    stored ? checkInOf(stored) : NO_CHECK_IN,
    stored?.weight ?? null,
  );
  const suggestion = stored?.suggestionDecision ? stored.suggestion : computed.suggestion;
  return {
    kind: 'review' as const,
    weekStart: week.monday,
    weekNumber: week.weekNumber,
    state: reviewState(week.monday, context.now, context.profile.timezone),
    units: context.profile.preferred_units,
    stored,
    ...computed,
    // D75: once answered, the offered change stays as it was (BR-19: one change per week).
    suggestion: suggestion ? describeSuggestion(context, suggestion) : null,
    decision: stored?.suggestionDecision ?? null,
  };
}

/** PRD §6.9: the review open now, if any (D68), for the way in from Progress and, later, Today. */
export async function getOpenReview(client: DbClient, clock: Clock) {
  const context = await loadSchedule(client, clock);
  if (typeof context === 'string') return null;
  const monday = openReviewWeek({
    now: context.now,
    timeZone: context.profile.timezone,
    programmeStart: context.enrolment.startDate,
    durationWeeks: context.programme.shape.durationWeeks,
  });
  if (!monday) return null;
  const week = buildWeek(context.scheduleInput, monday, context.now);
  const stored = await findReview(client, context.userId, monday);
  return { weekStart: monday, weekNumber: week.weekNumber!, saved: stored !== null };
}

export type ReviewView = Extract<
  NonNullable<Awaited<ReturnType<typeof getReview>>>,
  { kind: 'review' }
>;

export type SaveReviewResult =
  | { ok: true; reviewId: string }
  | {
      ok: false;
      error: 'invalid_input' | 'not_signed_in' | 'not_enrolled' | 'not_a_week' | 'window_closed';
    };

export async function saveReview(
  client: DbClient,
  input: unknown,
  clock: Clock,
  trackEvent: Track = track,
): Promise<SaveReviewResult> {
  const context = await loadSchedule(client, clock);
  if (context === 'not_signed_in') return { ok: false, error: 'not_signed_in' };
  const parsed = reviewInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  if (context === 'not_enrolled') return { ok: false, error: 'not_enrolled' };
  const week = programmeWeek(context, parsed.data.weekStart);
  if (!week) return { ok: false, error: 'not_a_week' };
  if (reviewState(week.monday, context.now, context.profile.timezone) !== 'open') {
    return { ok: false, error: 'window_closed' };
  }
  const { data } = parsed;
  const now = clock.now();
  const stored = await findReview(client, context.userId, week.monday);

  // D77: the review's weight is one measurement, edited in place and soft-deleted when cleared.
  let weight: ReviewRecord['weight'] = null;
  if (data.weight) {
    const id = stored?.weight?.id ?? data.weight.id;
    const kg = weightToKg(data.weight.value, data.weight.unit);
    await upsertReviewWeight(client, { id, userId: context.userId, kg, at: now });
    weight = { id, kg, at: now };
  } else if (stored?.weight) {
    await softDeleteMeasurement(client, stored.weight.id, now);
  }

  const checkIn: CheckIn = {
    fatigue: data.fatigue,
    soreness: data.soreness,
    sleep: data.sleep,
    motivation: data.motivation,
    pain: data.pain,
    painArea: data.painArea,
    painNote: data.pain ? data.painNote || null : null,
  };
  const computed = await computeReview(client, context, week, checkIn, weight);
  // One review per week: a second device's save updates the same review (the latest save wins, PRD §12).
  const reviewId = stored?.id ?? data.id;
  await upsertReview(client, {
    id: reviewId,
    userId: context.userId,
    userProgrammeId: context.enrolment.id,
    weekStart: week.monday,
    ...checkIn,
    notes: data.notes || null,
    recommendationKey: computed.recommendation,
    // D75 / BR-19: once answered, the offered change is never replaced.
    suggestion: stored?.suggestionDecision ? stored.suggestion : computed.suggestion,
    bodyMeasurementId: weight?.id ?? null,
    now,
  });
  // D80: pain reported after accepting a change withdraws it, unless a workout of its week already used it.
  if (checkIn.pain && stored?.suggestionDecision === 'accepted' && stored.suggestion) {
    const monday = addDays(context.enrolment.startDate, (stored.suggestion.fromWeek - 1) * 7);
    const { workouts } = await findWeekActivity(
      client,
      context.userId,
      context.enrolment.id,
      monday,
      addDays(monday, 6),
    );
    await withdrawOnPain(client, context, stored, workouts, now);
  }
  // D78: sent once, on the week's first save; IDs only, never the check-in (D72).
  if (!stored) {
    await trackEvent(
      { name: 'weekly_review_completed', properties: { weekly_review_id: reviewId } },
      context.userId,
    );
  }
  return { ok: true, reviewId };
}

/** The stored review, for the review screens (AGENTS §5.2: components go through services). */
export type { ReviewRecord } from '@/server/repositories/reviews';

import {
  type Clock,
  keepsAcceptedChange,
  type PrescriptionOverride,
  resolvePrescription,
  reviewState,
  type Suggestion,
  suggestionOverride,
} from '@getfit/domain';
import { decideSuggestionSchema } from '@/lib/validation/review';
import type { DbClient } from '@/server/db/client';
import type { ProgrammeContent } from '@/server/repositories/programme';
import {
  deletePrescriptionOverride,
  findReview,
  type ReviewRecord,
  insertPrescriptionOverride,
  setSuggestionDecision,
} from '@/server/repositories/reviews';
import { loadSchedule, type ScheduleContext } from './schedule';

// BR-19 / D75 / D79 / D80: the week's suggested progression, accepted or declined once by the user. An accepted
// change is a `prescription_overrides` row from the next week; the programme template and logged history are never
// edited (BR-25). Nothing changes on its own (BR-18).

/** The long run's template exercise: the distance target of the programme's run session (content, D25). */
export function longRunExercise(programme: ProgrammeContent) {
  for (const template of programme.templates.values()) {
    if (template.ref.sessionType !== 'run') continue;
    const exercise = template.exercises.find((e) => e.target.kind === 'distance');
    if (exercise) return exercise;
  }
  return null;
}

/** D71: the long run's ceiling in a week, after any accepted change (and never in the deload). */
export function longRunCeiling(
  programme: ProgrammeContent,
  weekNumber: number,
  overrides: readonly PrescriptionOverride[],
): number | null {
  const exercise = longRunExercise(programme);
  const week = programme.weeks.get(weekNumber)?.week;
  if (!exercise || !week) return null;
  const { target } = resolvePrescription(exercise, week, overrides);
  return target.kind === 'distance' ? target.metres : null;
}

/** What the suggestion card says: the exercise, its session and its sets in the week it would start. */
export function describeSuggestion(context: ScheduleContext, suggestion: Suggestion) {
  if (suggestion.kind === 'long_run') return suggestion;
  for (const template of context.programme.templates.values()) {
    const exercise = template.exercises.find((e) => e.id === suggestion.templateExerciseId);
    if (!exercise) continue;
    const week = context.programme.weeks.get(suggestion.fromWeek)?.week;
    return {
      ...suggestion,
      exercise: template.exerciseInfo.get(exercise.exerciseId)?.name ?? '',
      session: template.title,
      perSide: exercise.perSide,
      sets: week ? resolvePrescription(exercise, week, []).sets : exercise.sets,
    };
  }
  return null;
}

const overrideOf = (context: ScheduleContext, suggestion: Suggestion) =>
  suggestionOverride(suggestion, longRunExercise(context.programme)?.id ?? null);

export type DecideResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | 'invalid_input'
        | 'not_signed_in'
        | 'not_enrolled'
        | 'no_review'
        | 'window_closed'
        | 'no_suggestion'
        | 'already_decided';
    };

/** D79: accept or decline the week's suggestion, once, while its review is open (D68). */
export async function decideSuggestion(
  client: DbClient,
  input: unknown,
  clock: Clock,
): Promise<DecideResult> {
  const context = await loadSchedule(client, clock);
  if (context === 'not_signed_in') return { ok: false, error: 'not_signed_in' };
  const parsed = decideSuggestionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  if (context === 'not_enrolled') return { ok: false, error: 'not_enrolled' };
  const review = await findReview(client, context.userId, parsed.data.weekStart);
  if (!review) return { ok: false, error: 'no_review' };
  if (reviewState(review.weekStart, context.now, context.profile.timezone) !== 'open') {
    return { ok: false, error: 'window_closed' };
  }
  if (!review.suggestion) return { ok: false, error: 'no_suggestion' };
  if (review.suggestionDecision) return { ok: false, error: 'already_decided' };
  const now = clock.now();
  if (parsed.data.decision === 'accepted') {
    const override = overrideOf(context, review.suggestion);
    await insertPrescriptionOverride(client, {
      userProgrammeId: context.enrolment.id,
      templateExerciseId: override.templateExerciseId,
      fromWeek: override.fromWeek,
      targetReps: override.target.kind === 'reps' ? override.target.reps : null,
      targetDistanceM: override.target.kind === 'distance' ? override.target.metres : null,
      at: now,
    });
  }
  await setSuggestionDecision(client, review.id, parsed.data.decision, now);
  return { ok: true };
}

/**
 * D80: pain reported in a review whose suggestion was accepted withdraws the change, unless a workout of its week
 * already used it. `fromWeekWorkouts` are the workouts logged in that week.
 */
export async function withdrawOnPain(
  client: DbClient,
  context: ScheduleContext,
  review: ReviewRecord,
  fromWeekWorkouts: readonly {
    prescriptions: readonly { templateExerciseId: string; overridden: boolean }[];
  }[],
  now: Date,
): Promise<boolean> {
  if (review.suggestionDecision !== 'accepted' || !review.suggestion) return false;
  const override = overrideOf(context, review.suggestion);
  if (keepsAcceptedChange(override, fromWeekWorkouts)) return false;
  await deletePrescriptionOverride(client, {
    userProgrammeId: context.enrolment.id,
    templateExerciseId: override.templateExerciseId,
    fromWeek: override.fromWeek,
  });
  await setSuggestionDecision(client, review.id, 'withdrawn', now);
  return true;
}

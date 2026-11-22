import {
  type LocalDate,
  type PainArea,
  parseLocalDate,
  parseSnapshot,
  type RecommendationKey,
  type ReviewRun,
  type ReviewWorkout,
  type Suggestion,
} from '@getfit/domain';
import type { DbClient } from '@/server/db/client';
import type { Json } from '@/server/db/types';

// PRD §6.9 weekly review: the stored check-in (D72), its recommendation (D64) and suggestion (D75), and the week's
// logged activity the review is computed from (BR-25: read only, never edited). Writes are upserts by the device's
// ID (AGENTS §6).

const fail = (table: string, code: string | undefined): never => {
  throw new Error(`${table}: ${code}`);
};

export interface ReviewRecord {
  id: string;
  weekStart: LocalDate;
  fatigue: number | null;
  soreness: number | null;
  sleep: number | null;
  motivation: number | null;
  pain: boolean;
  painArea: PainArea | null;
  painNote: string | null;
  notes: string | null;
  recommendationKey: RecommendationKey | null;
  suggestion: Suggestion | null;
  suggestionDecision: 'accepted' | 'declined' | null;
  /** D77: the weight entered with the review, if it is still there. */
  weight: { id: string; kg: number; at: Date } | null;
}

const REVIEW = `id, week_start, fatigue, soreness, sleep_quality, motivation, pain, pain_location, pain_notes, notes,
  recommendation_key, suggestion, suggestion_decision,
  body_measurements (id, weight_kg, measured_at, deleted_at)`;

export async function findReview(
  client: DbClient,
  userId: string,
  weekStart: LocalDate,
): Promise<ReviewRecord | null> {
  const { data, error } = await client
    .from('weekly_reviews')
    .select(REVIEW)
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .maybeSingle();
  if (error) fail('weekly_reviews', error.code);
  if (!data) return null;
  const m = data.body_measurements;
  return {
    id: data.id,
    weekStart: parseLocalDate(data.week_start),
    fatigue: data.fatigue,
    soreness: data.soreness,
    sleep: data.sleep_quality,
    motivation: data.motivation,
    pain: data.pain,
    painArea: data.pain_location as PainArea | null,
    painNote: data.pain_notes,
    notes: data.notes,
    recommendationKey: data.recommendation_key as RecommendationKey | null,
    suggestion: data.suggestion as Suggestion | null,
    suggestionDecision: data.suggestion_decision as ReviewRecord['suggestionDecision'],
    weight:
      m && !m.deleted_at && m.weight_kg !== null
        ? { id: m.id, kg: Number(m.weight_kg), at: new Date(m.measured_at) }
        : null,
  };
}

export interface ReviewWrite {
  id: string;
  userId: string;
  userProgrammeId: string;
  weekStart: LocalDate;
  fatigue: number | null;
  soreness: number | null;
  sleep: number | null;
  motivation: number | null;
  pain: boolean;
  painArea: PainArea | null;
  painNote: string | null;
  notes: string | null;
  recommendationKey: RecommendationKey;
  suggestion: Suggestion | null;
  bodyMeasurementId: string | null;
  now: Date;
}

export async function upsertReview(client: DbClient, w: ReviewWrite): Promise<void> {
  const { error } = await client.from('weekly_reviews').upsert(
    {
      id: w.id,
      user_id: w.userId,
      user_programme_id: w.userProgrammeId,
      week_start: w.weekStart,
      fatigue: w.fatigue,
      soreness: w.soreness,
      sleep_quality: w.sleep,
      motivation: w.motivation,
      pain: w.pain,
      pain_location: w.painArea,
      pain_notes: w.painNote,
      notes: w.notes,
      recommendation_key: w.recommendationKey,
      suggestion: w.suggestion as Json | null,
      body_measurement_id: w.bodyMeasurementId,
      client_updated_at: w.now.toISOString(),
      updated_at: w.now.toISOString(),
    },
    { onConflict: 'id' },
  );
  if (error) fail('weekly_reviews', error.code);
}

/** D77: the review's weight, an ordinary measurement (not a baseline) dated when it is entered. */
export async function upsertReviewWeight(
  client: DbClient,
  w: { id: string; userId: string; kg: number; at: Date },
): Promise<void> {
  const { error } = await client.from('body_measurements').upsert(
    {
      id: w.id,
      user_id: w.userId,
      measured_at: w.at.toISOString(),
      weight_kg: w.kg,
      is_baseline: false,
      client_updated_at: w.at.toISOString(),
      deleted_at: null,
    },
    { onConflict: 'id' },
  );
  if (error) fail('body_measurements', error.code);
}

/** D77: a cleared weight is soft-deleted, so the deletion syncs (AGENTS §6). */
export async function softDeleteMeasurement(client: DbClient, id: string, now: Date) {
  const { error } = await client
    .from('body_measurements')
    .update({ deleted_at: now.toISOString(), client_updated_at: now.toISOString() })
    .eq('id', id);
  if (error) fail('body_measurements', error.code);
}

/**
 * D67 / D77: the weights a week's review compares. `latest` is the review's own weight, or else the latest measured
 * in the week that no other review holds; `previous` is the latest measured before it, the baseline included.
 */
export async function findReviewWeights(
  client: DbClient,
  userId: string,
  week: { start: Date; end: Date; reviewWeight: { id: string; kg: number; at: Date } | null },
): Promise<{ latestKg: number | null; previousKg: number | null }> {
  const [weights, held] = await Promise.all([
    client
      .from('body_measurements')
      .select('id, weight_kg, measured_at')
      .eq('user_id', userId)
      .not('weight_kg', 'is', null)
      .is('deleted_at', null)
      .order('measured_at', { ascending: false }),
    client.from('weekly_reviews').select('body_measurement_id').eq('user_id', userId),
  ]);
  if (weights.error) fail('body_measurements', weights.error.code);
  if (held.error) fail('weekly_reviews', held.error.code);
  const others = new Set(
    held.data!.map((r) => r.body_measurement_id).filter((id) => id !== week.reviewWeight?.id),
  );
  const rows = weights.data!.map((r) => ({
    id: r.id,
    kg: Number(r.weight_kg),
    at: new Date(r.measured_at),
  }));
  const inWeek = (at: Date) => at >= week.start && at < week.end;
  const latest = week.reviewWeight ?? rows.find((r) => inWeek(r.at) && !others.has(r.id)) ?? null;
  if (!latest) return { latestKg: null, previousKg: null };
  const previous = rows.find((r) => r.id !== latest.id && r.at < latest.at);
  return { latestKg: latest.kg, previousKg: previous?.kg ?? null };
}

/**
 * The week's logged workouts (with their snapshot and sets, BR-25) and runs, by date; a run is linked when it
 * fulfils a programme day (D33). Baselines and deleted rows never count (BR-26).
 */
export async function findWeekActivity(
  client: DbClient,
  userId: string,
  userProgrammeId: string,
  from: LocalDate,
  to: LocalDate,
): Promise<{ workouts: ReviewWorkout[]; runs: ReviewRun[] }> {
  const [workouts, runs] = await Promise.all([
    client
      .from('workout_sessions')
      .select(
        `id, status, rpe, prescription_snapshot,
         workout_sets (exercise_id, substituted_for_exercise_id, set_number, side, actual_reps, actual_duration_s, rir, completed)`,
      )
      .eq('user_programme_id', userProgrammeId)
      .gte('scheduled_date', from)
      .lte('scheduled_date', to)
      .neq('status', 'abandoned')
      .is('deleted_at', null)
      .order('scheduled_date'),
    client
      .from('running_sessions')
      .select('distance_m, rpe, programme_day_id')
      .eq('user_id', userId)
      .eq('is_baseline', false)
      .is('deleted_at', null)
      .gte('local_date', from)
      .lte('local_date', to),
  ]);
  if (workouts.error) fail('workout_sessions', workouts.error.code);
  if (runs.error) fail('running_sessions', runs.error.code);
  return {
    workouts: workouts.data!.map((w) => {
      const parsed = parseSnapshot(w.prescription_snapshot);
      if (!parsed.ok) throw new Error(`workout_sessions: unreadable snapshot on ${w.id}`);
      return {
        status: w.status as ReviewWorkout['status'],
        rpe: w.rpe,
        prescriptions: parsed.snapshot.exercises,
        sets: w.workout_sets.map((s) => ({
          exerciseId: s.exercise_id,
          substitutedForExerciseId: s.substituted_for_exercise_id,
          setNumber: s.set_number,
          side: s.side,
          actualReps: s.actual_reps,
          actualDurationS: s.actual_duration_s,
          rir: s.rir,
          completed: s.completed,
        })),
      };
    }),
    runs: runs.data!.map((r) => ({
      distanceM: r.distance_m,
      rpe: r.rpe,
      linked: r.programme_day_id !== null,
    })),
  };
}

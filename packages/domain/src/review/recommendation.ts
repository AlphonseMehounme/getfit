// D64: the weekly review gives exactly one recommendation, caution first. Pain always leads to the cautious path
// (BR-27), so a week with pain never shows a progression (PRD §6.9 AC).
import { type CheckIn, recoveryLow } from './check-in';
import type { InsightKey } from './insights';
import type { Suggestion } from './progression';
import type { WeekSummary } from './summary';

export type RecommendationKey =
  | 'reduce_or_rest'
  | 'add_recovery_day'
  | 'reduce_sets'
  | 'keep_distance_stable'
  | 'accept_progression'
  | 'maintain';

export function recommend(input: {
  checkIn: CheckIn;
  summary: WeekSummary;
  insights: readonly InsightKey[];
  suggestion: Suggestion | null;
}): RecommendationKey {
  const { checkIn, summary, insights, suggestion } = input;
  if (checkIn.pain) return 'reduce_or_rest';
  if (recoveryLow(checkIn)) return 'add_recovery_day';
  if (summary.missed >= 2 || (summary.averageRpe.available && summary.averageRpe.value > 7)) {
    return 'reduce_sets';
  }
  if (insights.includes('distance_up')) return 'keep_distance_stable';
  if (suggestion) return 'accept_progression';
  return 'maintain';
}

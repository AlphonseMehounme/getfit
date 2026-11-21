// D69: the weekly review's insights, from logged data and the check-in only (PRD §6.9 AC). Each key names its rule,
// which the review shows on tap.
import { type CheckIn, recoveryLow } from './check-in';
import type { WeekSummary } from './summary';

export type InsightKey =
  | 'frequency_up'
  | 'frequency_down'
  | 'distance_up'
  | 'missed_sessions'
  | 'rpe_high'
  | 'recovery_low'
  | 'volume_stable';

/** D69 / PRD §6.9: distance up "more than 10%"; volume "stable" within ±10%. */
export const DISTANCE_UP_RATIO = 1.1;
export const VOLUME_STABLE_RATIO = 0.1;

const done = (s: WeekSummary) => s.completed + s.partial;

/** `previous` is the previous programme week's summary, or null in week 1. */
export function weekInsights(
  current: WeekSummary,
  previous: WeekSummary | null,
  checkIn: CheckIn,
): InsightKey[] {
  const insights: InsightKey[] = [];
  if (previous && done(current) > done(previous)) insights.push('frequency_up');
  if (previous && done(current) < done(previous)) insights.push('frequency_down');
  if (
    previous &&
    previous.distanceM > 0 &&
    current.distanceM > previous.distanceM * DISTANCE_UP_RATIO
  ) {
    insights.push('distance_up');
  }
  if (current.missed >= 2) insights.push('missed_sessions');
  if (current.averageRpe.available && current.averageRpe.value > 7) insights.push('rpe_high');
  if (recoveryLow(checkIn)) insights.push('recovery_low');
  if (
    insights.length === 0 &&
    previous &&
    previous.strengthSets > 0 &&
    Math.abs(current.strengthSets - previous.strengthSets) <=
      previous.strengthSets * VOLUME_STABLE_RATIO
  ) {
    insights.push('volume_stable');
  }
  return insights;
}

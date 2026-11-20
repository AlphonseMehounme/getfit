import { type LocalDate, localDateAt } from '@getfit/domain';
import type { Locale } from '@/lib/i18n/config';
import type { DbClient } from '@/server/db/client';
import {
  findRunHistory,
  findWorkoutHistory,
  type HistoryCursor,
} from '@/server/repositories/history';

// The user's logged workouts and runs, newest first, as logged (BR-25). One merge for Train's history and Today's
// recent activity (AGENTS §5.3).

export type HistoryItem =
  | {
      kind: 'workout';
      id: string;
      startedAt: Date;
      date: LocalDate;
      title: string | null;
      status: 'in_progress' | 'partial' | 'completed';
      durationS: number | null;
      setsLogged: number;
    }
  | {
      kind: 'run';
      id: string;
      startedAt: Date;
      date: LocalDate;
      distanceM: number;
      durationS: number;
      linked: boolean;
    };

/** Newest first; at the same instant, the higher ID first (as the repositories order them). */
const newestFirst = (a: HistoryItem, b: HistoryItem) =>
  b.startedAt.getTime() - a.startedAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

/**
 * The user's workouts and runs, newest first, older than `before`: up to `limit` items. Shared by Train's history
 * and Today's recent activity (AGENTS §5.3).
 */
export async function historyItems(
  client: DbClient,
  userId: string,
  profile: { locale: Locale; timezone: string },
  options: { before: HistoryCursor | null; limit: number },
): Promise<HistoryItem[]> {
  const [workouts, runs] = await Promise.all([
    findWorkoutHistory(client, userId, { ...options, locale: profile.locale }),
    findRunHistory(client, userId, options),
  ]);
  const zone = profile.timezone;
  return [
    ...workouts.map((w): HistoryItem => ({
      kind: 'workout',
      ...w,
      date: localDateAt(w.startedAt, zone),
    })),
    ...runs.map((r): HistoryItem => ({ kind: 'run', ...r, date: localDateAt(r.startedAt, zone) })),
  ]
    .sort(newestFirst)
    .slice(0, options.limit);
}

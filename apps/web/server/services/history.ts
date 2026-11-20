import { type Clock, type LocalDate, localDateAt, parseInstant } from '@getfit/domain';
import { z } from 'zod';
import type { DbClient } from '@/server/db/client';
import {
  findRunHistory,
  findWorkoutHistory,
  type HistoryCursor,
} from '@/server/repositories/history';
import { findProfileSettings } from '@/server/repositories/profiles';
import { getCurrentUser } from './auth';
import { getToday, type TodayView } from './schedule';

// PRD §9 Train: today's action, and the history of workouts and runs, newest first, a page at a time. History is
// shown as logged (BR-25); pace is computed at display (BR-22).

export const HISTORY_PAGE_SIZE = 20;

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

export interface TrainHub {
  today: TodayView;
  units: 'metric' | 'imperial';
  history: HistoryItem[];
  /** The cursor for the next (older) page, or null at the end. */
  nextBefore: string | null;
}

const cursorSchema = z
  .string()
  .regex(/^[^|]+\|[0-9a-f-]{36}$/)
  .transform((value, ctx): HistoryCursor | typeof z.NEVER => {
    const [at, id] = value.split('|') as [string, string];
    try {
      return { at: parseInstant(at), id };
    } catch {
      ctx.addIssue({ code: 'custom', message: 'invalidCursor' });
      return z.NEVER;
    }
  });

const cursorOf = (item: HistoryItem) => `${item.startedAt.toISOString()}|${item.id}`;

/** Newest first; at the same instant, the higher ID first (as the repositories order them). */
const newestFirst = (a: HistoryItem, b: HistoryItem) =>
  b.startedAt.getTime() - a.startedAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0);

/** Null when nobody is signed in. An invalid `before` reads as the first page. */
export async function getTrainHub(
  client: DbClient,
  input: { before?: string | undefined },
  clock: Clock,
): Promise<TrainHub | null> {
  const user = await getCurrentUser(client);
  if (!user) return null;
  const profile = await findProfileSettings(client, user.id);
  if (!profile) throw new Error('profile missing for signed-in user');
  const parsed = cursorSchema.safeParse(input.before);
  const before = parsed.success ? parsed.data : null;
  const limit = HISTORY_PAGE_SIZE + 1;

  const [today, workouts, runs] = await Promise.all([
    getToday(client, clock),
    findWorkoutHistory(client, user.id, { before, limit, locale: profile.locale }),
    findRunHistory(client, user.id, { before, limit }),
  ]);
  const zone = profile.timezone;
  const merged: HistoryItem[] = [
    ...workouts.map((w): HistoryItem => ({
      kind: 'workout',
      ...w,
      date: localDateAt(w.startedAt, zone),
    })),
    ...runs.map((r): HistoryItem => ({ kind: 'run', ...r, date: localDateAt(r.startedAt, zone) })),
  ].sort(newestFirst);
  const page = merged.slice(0, HISTORY_PAGE_SIZE);
  return {
    today: today!,
    units: profile.preferred_units,
    history: page,
    nextBefore: merged.length > HISTORY_PAGE_SIZE ? cursorOf(page.at(-1)!) : null,
  };
}

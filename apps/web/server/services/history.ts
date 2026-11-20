import { type Clock, parseInstant } from '@getfit/domain';
import { z } from 'zod';
import type { DbClient } from '@/server/db/client';
import type { HistoryCursor } from '@/server/repositories/history';
import { findProfileSettings } from '@/server/repositories/profiles';
import { getCurrentUser } from './auth';
import { type HistoryItem, historyItems } from './activity';
import { getToday, type TodayView } from './schedule';

export type { HistoryItem } from './activity';

// PRD §9 Train: today's action, and the history of workouts and runs, newest first, a page at a time. History is
// shown as logged (BR-25); pace is computed at display (BR-22).

export const HISTORY_PAGE_SIZE = 20;

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

  const [today, items] = await Promise.all([
    getToday(client, clock),
    historyItems(client, user.id, profile, { before, limit: HISTORY_PAGE_SIZE + 1 }),
  ]);
  const page = items.slice(0, HISTORY_PAGE_SIZE);
  return {
    today: today!,
    units: profile.preferred_units,
    history: page,
    nextBefore: items.length > HISTORY_PAGE_SIZE ? cursorOf(page.at(-1)!) : null,
  };
}

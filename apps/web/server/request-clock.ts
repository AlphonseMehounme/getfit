import type { Clock } from '@getfit/domain';
import { headers } from 'next/headers';
import { resolveClock, TEST_NOW_HEADER } from './clock';

/** The clock for the current request (pages and server actions). See clock.ts for the D20 / D30 rules. */
export async function getRequestClock(): Promise<Clock> {
  return resolveClock(process.env, (await headers()).get(TEST_NOW_HEADER));
}

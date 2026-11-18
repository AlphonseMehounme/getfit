'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRequestClock } from '@/server/request-clock';
import {
  type FinishSessionResult,
  finishSession,
  type LogSetResult,
  logSet,
  type PauseResult,
  pauseSession,
  resumeSession,
  type StartSessionResult,
  startSession,
} from '@/server/services/workout';

// PRD §6.5: the workout screen's writes (P1-17b). Each action is a thin call into the service with the request
// clock (D20, D30). Results carry error codes only; the screen turns them into generic, translated messages
// (AGENTS §12).

export async function startSessionAction(input: unknown): Promise<StartSessionResult> {
  return startSession(await createSupabaseServerClient(), input, await getRequestClock());
}

export async function logSetAction(input: unknown): Promise<LogSetResult> {
  return logSet(await createSupabaseServerClient(), input, await getRequestClock());
}

export async function finishSessionAction(input: unknown): Promise<FinishSessionResult> {
  return finishSession(await createSupabaseServerClient(), input, await getRequestClock());
}

export async function pauseSessionAction(input: unknown): Promise<PauseResult> {
  return pauseSession(await createSupabaseServerClient(), input, await getRequestClock());
}

export async function resumeSessionAction(input: unknown): Promise<PauseResult> {
  return resumeSession(await createSupabaseServerClient(), input, await getRequestClock());
}

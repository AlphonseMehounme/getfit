'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRequestClock } from '@/server/request-clock';
import {
  moveSession,
  type MoveResult,
  skipSession,
  type SkipResult,
  undoOverride,
  type UndoResult,
} from '@/server/services/programme';

// PRD §6.4: reschedule, skip and undo from the programme calendar (P2-11 wires the UI). The services validate and
// apply every rule; these only pass the request's session and clock.

export async function moveSessionAction(input: unknown): Promise<MoveResult> {
  return moveSession(await createSupabaseServerClient(), input, await getRequestClock());
}

export async function skipSessionAction(input: unknown): Promise<SkipResult> {
  return skipSession(await createSupabaseServerClient(), input, await getRequestClock());
}

export async function undoOverrideAction(input: unknown): Promise<UndoResult> {
  return undoOverride(await createSupabaseServerClient(), input, await getRequestClock());
}

'use server';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRequestClock } from '@/server/request-clock';
import {
  deleteRun,
  type DeleteRunResult,
  editRun,
  type EditRunResult,
  getRunLinkOption,
  logRun,
  type LogRunResult,
} from '@/server/services/running';

// PRD §6.6: log, edit and delete runs (P2-13 wires the form). The service validates and applies every rule.

export async function logRunAction(input: unknown): Promise<LogRunResult> {
  return logRun(await createSupabaseServerClient(), input, await getRequestClock());
}

export async function editRunAction(input: unknown): Promise<EditRunResult> {
  return editRun(await createSupabaseServerClient(), input, await getRequestClock());
}

export async function deleteRunAction(input: unknown): Promise<DeleteRunResult> {
  return deleteRun(await createSupabaseServerClient(), input, await getRequestClock());
}

export async function runLinkOptionAction(input: unknown) {
  return getRunLinkOption(await createSupabaseServerClient(), input, await getRequestClock());
}

import { z } from 'zod';

// PRD §12 / AGENTS §12: product events carry IDs, counts, booleans and fixed enums only.
// No free text can be expressed, so no email, name, note or pain detail can reach analytics (A2-16).
// Each feature may extend its own event, within the same rule.

const id = z.uuid();
const count = z.number().int().nonnegative();
const props = <T extends z.ZodRawShape>(shape: T) => z.object(shape).strict();

export const EVENT_SCHEMAS = {
  account_created: props({}),
  onboarding_completed: props({ skipped_steps: count }),
  programme_started: props({
    programme_id: id,
    user_programme_id: id,
    start_mode: z.enum(['next_monday', 'this_week']),
  }),
  workout_started: props({
    workout_session_id: id,
    programme_day_id: id.nullable(),
    resumed: z.boolean(),
  }),
  workout_completed: props({
    workout_session_id: id,
    status: z.enum(['completed', 'partial']),
    sets_logged: count,
    duration_s: count,
  }),
  workout_abandoned: props({ workout_session_id: id }),
  running_session_logged: props({ running_session_id: id, linked_to_programme: z.boolean() }),
  weekly_review_completed: props({ weekly_review_id: id }),
  programme_completed: props({ user_programme_id: id }),
  progress_viewed: props({ range: z.enum(['4w', '8w', 'programme', 'all']) }),
  session_rescheduled: props({
    programme_day_id: id,
    // D38: undoing a move or a skip.
    action: z.enum(['moved', 'skipped', 'undone']),
  }),
  sync_conflict: props({
    record_type: z.enum(['workout_session', 'workout_set', 'running_session']),
    record_id: id,
  }),
} as const;

export type EventName = keyof typeof EVENT_SCHEMAS;

/** A product event: its name and exactly the properties its schema allows. */
export type AnalyticsEvent = {
  [N in EventName]: { name: N; properties: z.infer<(typeof EVENT_SCHEMAS)[N]> };
}[EventName];

export class InvalidEventError extends Error {
  override name = 'InvalidEventError';
  constructor(readonly eventName: string) {
    super(`Analytics event "${eventName}" does not match its schema`);
  }
}

/** Runtime check behind the type: unknown names, unknown keys and free-text values are rejected. */
export function parseEvent(event: { name: string; properties: unknown }): AnalyticsEvent {
  const schema = (EVENT_SCHEMAS as Record<string, z.ZodType>)[event.name];
  const parsed = schema?.safeParse(event.properties);
  if (!parsed?.success) throw new InvalidEventError(event.name);
  return { name: event.name, properties: parsed.data } as AnalyticsEvent;
}

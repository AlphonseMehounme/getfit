-- P2-03 / D34: a pause is persisted. `paused_at` holds the start of the current pause (null when not paused);
-- resuming adds the interval to `paused_s`. Only an in-progress session can be paused, and a pause never starts
-- before the session. The existing owner-only RLS policies on workout_sessions cover the new column.

alter table public.workout_sessions
  add column paused_at timestamptz,
  add constraint workout_sessions_paused_only_in_progress
    check (paused_at is null or status = 'in_progress'),
  add constraint workout_sessions_paused_after_start check (paused_at >= started_at);

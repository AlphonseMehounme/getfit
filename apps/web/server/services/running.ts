import {
  type Clock,
  instantAtLocalTime,
  type LocalDate,
  localDateAt,
  localTimeAt,
  mondayOf,
  moveContextFor,
  parseLocalDate,
  type RunLinkOption,
  runLinkOption,
  toMetres,
} from '@getfit/domain';
import { type Track, track } from '@/lib/observability/analytics';
import {
  deleteRunSchema,
  editRunSchema,
  logRunSchema,
  parseLocalStart,
  runDateSchema,
} from '@/lib/validation/running';
import type { DbClient } from '@/server/db/client';
import { findProfileSettings } from '@/server/repositories/profiles';
import {
  findRun,
  type RunRecord,
  type RunWrite,
  softDeleteRun,
  upsertRun,
} from '@/server/repositories/running';
import { deleteOverride, upsertOverride } from '@/server/repositories/schedule';
import { getCurrentUser } from './auth';
import { loadSchedule, type ScheduleContext } from './schedule';

// PRD §6.6 running log. Pace and speed are never stored: they are computed from the stored metres and seconds
// (BR-22). A run may fulfil the long run of its week (D33, D59–D61): the server works out what can be offered and
// refuses any other choice. Only the run and, for "move and link", the long run's override are written (BR-25).

type Failure = 'invalid_input' | 'not_signed_in';

export type LogRunResult =
  | { ok: true; linked: boolean }
  | { ok: false; error: Failure | 'future_start' | 'link_unavailable' | 'already_fulfilled' };

export type EditRunResult =
  | { ok: true; linked: boolean }
  | {
      ok: false;
      error: Failure | 'not_found' | 'future_start' | 'link_unavailable' | 'already_fulfilled';
    };

export type DeleteRunResult = { ok: true } | { ok: false; error: Failure | 'not_found' };

interface RunContext {
  userId: string;
  timeZone: string;
  /** Null when the user has no active enrolment: a run is then always unlinked. */
  schedule: ScheduleContext | null;
}

async function runContext(client: DbClient, clock: Clock): Promise<RunContext | null> {
  const user = await getCurrentUser(client);
  if (!user) return null;
  const profile = await findProfileSettings(client, user.id);
  if (!profile) throw new Error('profile missing for signed-in user');
  const schedule = await loadSchedule(client, clock);
  return {
    userId: user.id,
    timeZone: profile.timezone,
    schedule: typeof schedule === 'string' ? null : schedule,
  };
}

/**
 * D33: what a run on `date` may be offered. `replacing` is the run being edited: its own fulfilment and its own
 * day are left out, as if it were logged anew (D60).
 */
function linkOptionFor(
  context: RunContext,
  run: { id: string; date: LocalDate },
  replacing: RunRecord | null = null,
): RunLinkOption {
  const { schedule } = context;
  if (!schedule) return { kind: 'none', reason: 'no_long_run' };
  const ownDay = replacing?.link?.programmeDayId;
  const input = ownDay
    ? {
        ...schedule.scheduleInput,
        logged: schedule.scheduleInput.logged.filter((l) => l.programmeDayId !== ownDay),
      }
    : schedule.scheduleInput;
  const moveContext = moveContextFor(input, mondayOf(run.date), schedule.now, schedule.adHoc);
  return runLinkOption(moveContext, run);
}

/** The run's start as an instant, from the local time typed in the user's zone (AGENTS §6). */
function startOf(startedAt: string, timeZone: string) {
  const { date, hours, minutes } = parseLocalStart(startedAt);
  const localDate = parseLocalDate(date);
  return { localDate, at: instantAtLocalTime(localDate, hours, minutes, timeZone) };
}

/**
 * Writes the long run's side of a link (D33): moves it for "move and link", and removes a skip it replaces (D61).
 * Returns the run's link columns.
 */
async function applyLink(
  client: DbClient,
  schedule: ScheduleContext,
  option: Extract<RunLinkOption, { kind: 'link' | 'move_and_link' }>,
  date: LocalDate,
): Promise<NonNullable<RunRecord['link']>> {
  const enrolmentId = schedule.enrolment.id;
  const session = moveContextFor(
    schedule.scheduleInput,
    mondayOf(date),
    schedule.now,
  ).sessions.find((s) => s.programmeDayId === option.programmeDayId)!;
  if (option.kind === 'move_and_link' && date !== session.plannedDate) {
    await upsertOverride(client, {
      userProgrammeId: enrolmentId,
      programmeDayId: option.programmeDayId,
      originalDate: session.plannedDate,
      action: 'moved',
      newDate: date,
    });
  } else if (session.status === 'skipped' || option.kind === 'move_and_link') {
    // D61 (a skip replaced by the run), or a move back onto the planned date: no override is left.
    await deleteOverride(client, enrolmentId, option.programmeDayId);
  }
  return {
    userProgrammeId: enrolmentId,
    programmeDayId: option.programmeDayId,
    scheduledDate: date,
  };
}

/** The values a write needs from validated input. */
function fieldsOf(
  data: ReturnType<typeof logRunSchema.parse>,
  start: { localDate: LocalDate; at: Date },
) {
  return {
    id: data.id,
    startedAt: start.at,
    localDate: start.localDate,
    distanceM: toMetres(data.distance, data.distanceUnit),
    durationS: data.durationS,
    rpe: data.effort,
    routeName: data.routeName,
    notes: data.notes,
  };
}

const sameValues = (a: RunRecord, b: ReturnType<typeof fieldsOf>) =>
  a.startedAt.getTime() === b.startedAt.getTime() &&
  a.distanceM === b.distanceM &&
  a.durationS === b.durationS &&
  a.rpe === b.rpe &&
  a.routeName === b.routeName &&
  a.notes === b.notes;

/** D33's option with what the form says about it: the long run of that week, by name, and its current date. */
export type RunLinkPrompt = RunLinkOption & {
  longRun: { title: string; date: LocalDate } | null;
};

/** The long run planned in the week of `date`, for the prompt's wording. */
function longRunOf(context: RunContext, date: LocalDate): RunLinkPrompt['longRun'] {
  const { schedule } = context;
  if (!schedule) return null;
  const session = moveContextFor(
    schedule.scheduleInput,
    mondayOf(date),
    schedule.now,
  ).sessions.find(
    (s) => s.template.sessionType === 'run' && mondayOf(s.plannedDate) === mondayOf(date),
  );
  if (!session) return null;
  return {
    title: schedule.programme.templates.get(session.template.id)!.title,
    date: session.date,
  };
}

/** D33: what the run form offers for a start date (P2-13). Null when nobody is signed in. */
export async function getRunLinkOption(
  client: DbClient,
  input: unknown,
  clock: Clock,
): Promise<RunLinkPrompt | { kind: 'invalid' } | null> {
  const parsed = runDateSchema.safeParse(input);
  if (!parsed.success) return { kind: 'invalid' };
  const context = await runContext(client, clock);
  if (!context) return null;
  const date = parseLocalDate(parseLocalStart(parsed.data.startedAt).date);
  const replacing = parsed.data.id ? await findRun(client, parsed.data.id) : null;
  const option = linkOptionFor(context, { id: parsed.data.id ?? '', date }, replacing);
  return { ...option, longRun: longRunOf(context, date) };
}

/** Writes the run with the link the user chose, if the server offers it. */
async function save(
  client: DbClient,
  context: RunContext,
  fields: ReturnType<typeof fieldsOf>,
  choice: 'none' | 'link' | 'move_and_link',
  keep: RunRecord['link'],
  replacing: RunRecord | null,
  now: Date,
): Promise<
  { ok: true; linked: boolean } | { ok: false; error: 'link_unavailable' | 'already_fulfilled' }
> {
  let link = keep;
  if (!keep && choice !== 'none') {
    const option = linkOptionFor(context, { id: fields.id, date: fields.localDate }, replacing);
    if (option.kind !== choice || !context.schedule)
      return { ok: false, error: 'link_unavailable' };
    link = await applyLink(client, context.schedule, option, fields.localDate);
  }
  const write: RunWrite = { ...fields, link, userId: context.userId, now };
  const saved = await upsertRun(client, write);
  if (!saved.ok) return saved;
  return { ok: true, linked: link !== null };
}

export async function logRun(
  client: DbClient,
  input: unknown,
  clock: Clock,
  trackEvent: Track = track,
): Promise<LogRunResult> {
  const parsed = logRunSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  const context = await runContext(client, clock);
  if (!context) return { ok: false, error: 'not_signed_in' };
  const now = clock.now();
  const start = startOf(parsed.data.startedAt, context.timeZone);
  if (start.at.getTime() > now.getTime()) return { ok: false, error: 'future_start' };
  const fields = fieldsOf(parsed.data, start);

  const existing = await findRun(client, fields.id);
  if (existing) {
    // D21: a retry of the same run changes nothing; anything else under this ID is refused (and a baseline, BR-26).
    const retry = !existing.isBaseline && !existing.deletedAt && sameValues(existing, fields);
    return retry
      ? { ok: true, linked: existing.link !== null }
      : { ok: false, error: 'invalid_input' };
  }

  const result = await save(client, context, fields, parsed.data.link, null, null, now);
  if (!result.ok) return result;
  await trackEvent(
    {
      name: 'running_session_logged',
      properties: { running_session_id: fields.id, linked_to_programme: result.linked },
    },
    context.userId,
  );
  return result;
}

export async function editRun(
  client: DbClient,
  input: unknown,
  clock: Clock,
): Promise<EditRunResult> {
  const parsed = editRunSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  const context = await runContext(client, clock);
  if (!context) return { ok: false, error: 'not_signed_in' };
  const existing = await findRun(client, parsed.data.id);
  if (!existing || existing.isBaseline || existing.deletedAt)
    return { ok: false, error: 'not_found' };
  const now = clock.now();
  const start = startOf(parsed.data.startedAt, context.timeZone);
  if (start.at.getTime() > now.getTime()) return { ok: false, error: 'future_start' };
  const fields = fieldsOf(parsed.data, start);
  // D60: on the same day the link stays; on another day it is removed and offered again.
  const keep = existing.link && existing.localDate === fields.localDate ? existing.link : null;
  return save(client, context, fields, parsed.data.link, keep, existing, now);
}

/** A soft delete: the run stops counting and frees the day it fulfilled (D26). */
export async function deleteRun(
  client: DbClient,
  input: unknown,
  clock: Clock,
): Promise<DeleteRunResult> {
  const parsed = deleteRunSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  const user = await getCurrentUser(client);
  if (!user) return { ok: false, error: 'not_signed_in' };
  const existing = await findRun(client, parsed.data.id);
  if (!existing || existing.isBaseline || existing.deletedAt)
    return { ok: false, error: 'not_found' };
  await softDeleteRun(client, existing.id, clock.now());
  return { ok: true };
}

/** One of the user's runs for the edit form, in metres and seconds (converted at display). Null when absent. */
export async function getRun(client: DbClient, id: string): Promise<RunRecord | null> {
  if (!(await getCurrentUser(client))) return null;
  const run = await findRun(client, id);
  return run && !run.isBaseline && !run.deletedAt ? run : null;
}

/** What the run pages need about the user: units, and today's date and time in their zone (no hydration mismatch). */
export async function getRunFormContext(client: DbClient, clock: Clock) {
  const user = await getCurrentUser(client);
  if (!user) return null;
  const profile = await findProfileSettings(client, user.id);
  if (!profile) throw new Error('profile missing for signed-in user');
  const now = clock.now();
  return {
    units: profile.preferred_units,
    date: localDateAt(now, profile.timezone),
    time: localTimeAt(now, profile.timezone),
  };
}

/** A run for the record and edit pages, in the user's local time, with the long run it counts for (D33). */
export async function getRunRecord(client: DbClient, id: string, clock: Clock) {
  const run = await getRun(client, id);
  if (!run) return null;
  const context = await runContext(client, clock);
  if (!context) return null;
  const title = run.link ? titleOfDay(context, run.link.programmeDayId) : null;
  return {
    id: run.id,
    date: localDateAt(run.startedAt, context.timeZone),
    time: localTimeAt(run.startedAt, context.timeZone),
    distanceM: run.distanceM,
    durationS: run.durationS,
    rpe: run.rpe,
    routeName: run.routeName,
    notes: run.notes,
    countsFor: run.link && title ? { title, date: run.link.scheduledDate } : null,
  };
}

function titleOfDay(context: RunContext, programmeDayId: string): string | null {
  const programme = context.schedule?.programme;
  const day = programme?.shape.days.find((d) => d.id === programmeDayId);
  return day ? programme!.templates.get(day.template.id)!.title : null;
}

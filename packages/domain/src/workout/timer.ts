// D39: the rest timer and timed holds are computed from instants (an end time or a start time), never by counting
// ticks, so they stay correct across a screen lock or a throttled background tab. D43: when rest starts.
import type { Prescription } from '../prescription/types';
import type { Instant } from '../time/clock';
import { prescribedSlots, slotKey, type SetSlot } from './progress';

const MS_PER_S = 1000;

/** D39: the "+15 s" button. */
export const REST_EXTENSION_S = 15;

function assertSeconds(seconds: number, what: string) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    throw new RangeError(`${what} is a finite number of seconds ≥ 0`);
  }
}

const plusSeconds = (at: Instant, seconds: number): Instant =>
  new Date(at.getTime() + seconds * MS_PER_S);

/** D39: a rest that starts when a set is logged ends `restS` later. */
export function restEndsAt(loggedAt: Instant, restS: number): Instant {
  assertSeconds(restS, 'A rest');
  return plusSeconds(loggedAt, restS);
}

/** D39 "+15 s": extends a running rest; once it has run out, the extra time counts from now. */
export function extendRest(endsAt: Instant, now: Instant, seconds = REST_EXTENSION_S): Instant {
  assertSeconds(seconds, 'An extension');
  const from = endsAt.getTime() > now.getTime() ? endsAt : now;
  return plusSeconds(from, seconds);
}

/** Whole seconds left, rounded up so "0" is shown only once time is up; never negative. */
export function remainingSeconds(endsAt: Instant, now: Instant): number {
  return Math.max(0, Math.ceil((endsAt.getTime() - now.getTime()) / MS_PER_S));
}

export interface HoldState {
  /** Whole seconds held so far, capped at the target. */
  elapsedS: number;
  remainingS: number;
  done: boolean;
}

/** D39 timed holds (plank): a countdown from the hold's start to its target. */
export function holdState(startedAt: Instant, targetS: number, now: Instant): HoldState {
  assertSeconds(targetS, 'A hold target');
  const remainingS = remainingSeconds(plusSeconds(startedAt, targetS), now);
  return { elapsedS: targetS - remainingS, remainingS, done: remainingS === 0 };
}

/** What `restAfter` needs from each prescription: its slots and its rest. */
export interface RestPrescribedWorkout {
  exercises: readonly Pick<
    Prescription,
    'exerciseId' | 'sets' | 'perSide' | 'sequence' | 'restS'
  >[];
}

/**
 * D39 / D43: the rest to start after logging `slot`, or null for no rest.
 * No rest between the left and right side of a set (D43), after the workout's last prescribed set (D39),
 * or for a prescription without a rest. A substituted set passes the slot it fills (the original exercise).
 */
export function restAfter(snapshot: RestPrescribedWorkout, slot: SetSlot): number | null {
  if (slot.side === 'left') return null;
  const slots = prescribedSlots(snapshot);
  const key = slotKey(slot);
  const index = slots.findIndex((s) => slotKey(s) === key);
  if (index === -1 || index === slots.length - 1) return null;
  const prescription = snapshot.exercises.find((e) => e.exerciseId === slot.exerciseId);
  return prescription?.restS ?? null;
}

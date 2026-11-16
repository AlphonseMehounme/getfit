// ADR 0002: domain functions never read the real clock; `now` is always passed in.

/** A moment in time, in UTC. */
export type Instant = Date;

/** The app's single source of `now` (apps/web/server/clock.ts implements it, D20). */
export interface Clock {
  now(): Instant;
}

/** Parses an ISO 8601 timestamp that states its offset (`Z` or `±hh:mm`); throws otherwise. */
export function parseInstant(value: string): Instant {
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) {
    throw new RangeError(`Timestamp must include an offset: ${value}`);
  }
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) throw new RangeError(`Not a timestamp: ${value}`);
  return instant;
}

/** A clock that always returns the same instant, for tests and the D20 test clock. */
export function fixedClock(at: Instant): Clock {
  const time = at.getTime();
  return { now: () => new Date(time) };
}

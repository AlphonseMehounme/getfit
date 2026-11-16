// ADR 0002: a calendar date with no time and no time zone, as `YYYY-MM-DD`.
// Arithmetic here is pure calendar arithmetic; converting to or from instants lives in zone.ts.

declare const localDateBrand: unique symbol;
export type LocalDate = string & { readonly [localDateBrand]: true };

/** ISO weekday: 1 = Monday … 7 = Sunday (D5). */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const FORMAT = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

/** Days since 1970-01-01 for a valid calendar date, or null. */
function toEpochDay(value: string): number | null {
  const match = FORMAT.exec(value);
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  // Rejects dates like 2026-02-30 that Date.UTC would silently roll over.
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return ms / DAY_MS;
}

function fromEpochDay(epochDay: number): LocalDate {
  return new Date(epochDay * DAY_MS).toISOString().slice(0, 10) as LocalDate;
}

function epochDay(date: LocalDate): number {
  return toEpochDay(date) as number;
}

export function isLocalDate(value: unknown): value is LocalDate {
  return typeof value === 'string' && toEpochDay(value) !== null;
}

/** Validates `YYYY-MM-DD` (a real calendar date); throws otherwise. */
export function parseLocalDate(value: string): LocalDate {
  if (!isLocalDate(value)) throw new RangeError(`Not a calendar date (YYYY-MM-DD): ${value}`);
  return value;
}

export function addDays(date: LocalDate, days: number): LocalDate {
  if (!Number.isInteger(days)) throw new RangeError(`Days must be a whole number: ${days}`);
  return fromEpochDay(epochDay(date) + days);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return epochDay(to) - epochDay(from);
}

export function compareLocalDates(a: LocalDate, b: LocalDate): -1 | 0 | 1 {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function isoWeekday(date: LocalDate): IsoWeekday {
  // 1970-01-01 was a Thursday (ISO 4).
  return (((((epochDay(date) + 3) % 7) + 7) % 7) + 1) as IsoWeekday;
}

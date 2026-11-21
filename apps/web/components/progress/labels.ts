import type { LocalDate } from '@getfit/domain';
import type { useFormatter } from 'next-intl';
import type { ProgressView } from '@/server/services/progress';

// Presentation helpers shared by the Progress sections. Values come from the service; nothing is computed here.

export type RangeView = Extract<ProgressView, { kind: 'range' }>;
export type Formatter = ReturnType<typeof useFormatter>;

/** Noon UTC, formatted in UTC, so the calendar date never shifts with the viewer's time zone. */
const noonUtc = (date: string) => new Date(`${date}T12:00:00Z`);

/** "23 Nov" / "23 nov." */
export const dayLabel = (format: Formatter, date: LocalDate) =>
  format.dateTime(noonUtc(date), { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** A "YYYY-MM" month: "Nov 2026" / "nov. 2026". */
export const monthLabel = (format: Formatter, month: string) =>
  format.dateTime(noonUtc(`${month}-15`), { month: 'short', year: 'numeric', timeZone: 'UTC' });

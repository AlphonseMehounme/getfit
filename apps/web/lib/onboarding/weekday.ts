import type { IsoWeekday } from '@getfit/domain';

/** A date on weekday n (1 = Monday, D5), to format its name: 1 January 2024 was a Monday. Format it in UTC. */
export const weekdayDate = (day: IsoWeekday) => new Date(Date.UTC(2024, 0, day, 12));

import { describe, expect, it } from 'vitest';
import { parseInstant } from '../time/clock';
import { parseLocalDate } from '../time/local-date';
import { type Enrolment, firstScheduledDate, isNotScheduled, week1Monday } from './programme-start';

const d = parseLocalDate;
const PARIS = 'Europe/Paris';

describe('BR-2: programme start', () => {
  it('an enrolment on a Monday starts that day', () => {
    expect(week1Monday(d('2026-11-23'), 'next_monday')).toBe('2026-11-23');
    expect(week1Monday(d('2026-11-23'), 'this_week')).toBe('2026-11-23');
  });

  it('an enrolment on a Wednesday starts the next Monday', () => {
    expect(week1Monday(d('2026-11-18'), 'next_monday')).toBe('2026-11-23');
  });

  it('an enrolment on a Sunday starts the next day', () => {
    expect(week1Monday(d('2026-11-22'), 'next_monday')).toBe('2026-11-23');
  });

  it('"start this week" starts on this week\'s Monday', () => {
    expect(week1Monday(d('2026-11-18'), 'this_week')).toBe('2026-11-16');
  });

  describe('"start this week" on Wednesday 18 Nov, 10:00 Paris', () => {
    const enrolment: Enrolment = {
      startDate: d('2026-11-16'),
      startMode: 'this_week',
      enrolledAt: parseInstant('2026-11-18T09:00:00Z'),
    };

    it('Monday and Tuesday are not scheduled', () => {
      expect(isNotScheduled(d('2026-11-16'), enrolment, PARIS)).toBe(true);
      expect(isNotScheduled(d('2026-11-17'), enrolment, PARIS)).toBe(true);
    });

    it('the enrolment day and the rest of the programme are scheduled', () => {
      expect(firstScheduledDate(enrolment, PARIS)).toBe('2026-11-18');
      expect(isNotScheduled(d('2026-11-18'), enrolment, PARIS)).toBe(false);
      expect(isNotScheduled(d('2026-11-23'), enrolment, PARIS)).toBe(false);
    });

    it('dates before the programme are outside it, not "not scheduled"', () => {
      expect(isNotScheduled(d('2026-11-15'), enrolment, PARIS)).toBe(false);
    });
  });

  it('"start next Monday" has no unscheduled days', () => {
    const enrolment: Enrolment = {
      startDate: d('2026-11-23'),
      startMode: 'next_monday',
      enrolledAt: parseInstant('2026-11-18T09:00:00Z'),
    };
    expect(firstScheduledDate(enrolment, PARIS)).toBe('2026-11-23');
    expect(isNotScheduled(d('2026-11-23'), enrolment, PARIS)).toBe(false);
  });
});

describe('BR-4: a time-zone change recomputes the first scheduled day', () => {
  // Enrolled at 23:30 Sunday in New York: already Monday 05:30 in Paris.
  const enrolment: Enrolment = {
    startDate: d('2026-11-16'),
    startMode: 'this_week',
    enrolledAt: parseInstant('2026-11-17T04:30:00Z'),
  };

  it('uses the enrolment day in the current zone', () => {
    expect(firstScheduledDate(enrolment, 'America/New_York')).toBe('2026-11-16');
    expect(firstScheduledDate(enrolment, PARIS)).toBe('2026-11-17');
  });

  it('never moves the first day before week 1', () => {
    // Monday 00:30 in Paris is still Sunday in New York, the week before week 1.
    const early: Enrolment = { ...enrolment, enrolledAt: parseInstant('2026-11-15T23:30:00Z') };
    expect(firstScheduledDate(early, 'America/New_York')).toBe('2026-11-16');
  });
});

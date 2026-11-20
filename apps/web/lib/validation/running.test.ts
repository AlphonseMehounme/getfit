import { describe, expect, it } from 'vitest';
import { deleteRunSchema, logRunSchema, parseLocalStart, runDateSchema } from './running';

const RUN = {
  id: '00000000-0000-4000-8000-000000000001',
  startedAt: '2026-11-29T09:30',
  distance: 10.84,
  distanceUnit: 'km',
  durationS: 4770,
};

describe('run inputs (PRD §6.6, BR-20, BR-21)', () => {
  it('the reference run, with defaults for the optional fields', () => {
    expect(logRunSchema.parse(RUN)).toEqual({
      ...RUN,
      effort: null,
      routeName: null,
      notes: null,
      link: 'none',
    });
  });

  it('BR-21: distance and duration must be above 0', () => {
    expect(logRunSchema.safeParse({ ...RUN, distance: 0 }).success).toBe(false);
    expect(logRunSchema.safeParse({ ...RUN, durationS: 0 }).success).toBe(false);
    expect(logRunSchema.safeParse({ ...RUN, durationS: 12.5 }).success).toBe(false);
    const missing = logRunSchema.safeParse({ ...RUN, distance: undefined });
    expect(missing.success).toBe(false);
  });

  it('a start is a real local date and time', () => {
    for (const startedAt of [
      '2026-11-29',
      '2026-11-29T24:00',
      '2026-02-30T09:00',
      '2026-11-29 09:30',
    ]) {
      expect(logRunSchema.safeParse({ ...RUN, startedAt }).success).toBe(false);
    }
    expect(parseLocalStart('2026-11-29T09:05')).toEqual({
      date: '2026-11-29',
      hours: 9,
      minutes: 5,
    });
  });

  it('text is trimmed, blank is none, and too long is refused', () => {
    const parsed = logRunSchema.parse({
      ...RUN,
      routeName: '  Canal  ',
      notes: '   ',
      effort: 5,
      link: 'link',
    });
    expect(parsed).toMatchObject({ routeName: 'Canal', notes: null, effort: 5, link: 'link' });
    expect(logRunSchema.safeParse({ ...RUN, routeName: 'x'.repeat(81) }).success).toBe(false);
    expect(logRunSchema.safeParse({ ...RUN, notes: 'x'.repeat(1001) }).success).toBe(false);
    expect(logRunSchema.safeParse({ ...RUN, effort: 11 }).success).toBe(false);
    expect(logRunSchema.safeParse({ ...RUN, extra: 1 }).success).toBe(false);
  });

  it('delete and the link question take what they need', () => {
    expect(deleteRunSchema.safeParse({ id: RUN.id }).success).toBe(true);
    expect(runDateSchema.safeParse({ startedAt: RUN.startedAt }).success).toBe(true);
    expect(runDateSchema.safeParse({ startedAt: 'x' }).success).toBe(false);
  });
});

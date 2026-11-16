import { describe, expect, it } from 'vitest';
import type { SessionStatus } from '../status/session-status';
import { STANDARD_WEEK } from '../test-support/standard-programme';
import { weeklyAdherence } from './adherence';

const [A, RECOVERY, B, REST, C, , RUN] = STANDARD_WEEK as typeof STANDARD_WEEK & unknown[];
const s = (template: (typeof STANDARD_WEEK)[number], status: SessionStatus) => ({
  template,
  status,
});

describe('BR-8: weekly adherence', () => {
  it('counts partial as half, over the four training sessions', () => {
    const result = weeklyAdherence([
      s(A!, 'completed'),
      s(RECOVERY!, 'rest'),
      s(B!, 'partial'),
      s(REST!, 'rest'),
      s(C!, 'missed'),
      s(RUN!, 'completed'),
    ]);
    expect(result).toEqual({ available: true, completed: 2, partial: 1, planned: 4, ratio: 0.625 });
  });

  it('skipped and still scheduled sessions count as not done', () => {
    const result = weeklyAdherence([
      s(A!, 'skipped'),
      s(B!, 'scheduled'),
      s(C!, 'in_progress'),
      s(RUN!, 'completed'),
    ]);
    expect(result).toMatchObject({ planned: 4, ratio: 0.25 });
  });

  it('BR-2: not-scheduled days are excluded', () => {
    const result = weeklyAdherence([
      s(A!, 'not_scheduled'),
      s(B!, 'not_scheduled'),
      s(C!, 'completed'),
      s(RUN!, 'scheduled'),
    ]);
    expect(result).toMatchObject({ planned: 2, completed: 1, ratio: 0.5 });
  });

  it('BR-24: with no scheduled training sessions it is unavailable, not 0', () => {
    expect(weeklyAdherence([s(RECOVERY!, 'rest'), s(REST!, 'rest')])).toEqual({
      available: false,
      reason: 'no_scheduled_sessions',
    });
    expect(weeklyAdherence([])).toEqual({ available: false, reason: 'no_scheduled_sessions' });
  });
});

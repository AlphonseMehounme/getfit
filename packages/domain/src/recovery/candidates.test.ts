import { describe, expect, it } from 'vitest';
import { buildWeek } from '../schedule/engine';
import { dayId, standardProgramme } from '../test-support/standard-programme';
import { parseInstant } from '../time/clock';
import { parseLocalDate } from '../time/local-date';
import { listCandidates } from './candidates';
import type { MoveContext } from './evaluate-move';

const d = parseLocalDate;
const PARIS = 'Europe/Paris';
const WEEK_1 = d('2026-11-23');

function contextAt(nowIso: string): MoveContext {
  const now = parseInstant(nowIso);
  const input = {
    enrolment: {
      startDate: WEEK_1,
      startMode: 'next_monday' as const,
      enrolledAt: parseInstant('2026-11-18T09:00:00Z'),
    },
    programme: standardProgramme(),
    overrides: [],
    logged: [],
    timeZone: PARIS,
  };
  const sessions = [WEEK_1, d('2026-11-30'), d('2026-12-07')].flatMap((monday) =>
    buildWeek(input, monday, now).days.flatMap((day) => day.sessions),
  );
  return { sessions, now, timeZone: PARIS };
}

describe('BR-13: candidates and the skip recommendation', () => {
  it('Mon A missed: no valid date in the week, so skip — with the reason for every date', () => {
    const result = listCandidates(contextAt('2026-11-24T07:00:00Z'), dayId(1, 1));
    expect(result.movable).toBe(true);
    if (!result.movable) return;
    expect(result.recommendation).toBe('skip');
    expect(result.candidates.map((c) => c.date)).toEqual([
      '2026-11-24',
      '2026-11-25',
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
      '2026-11-29',
    ]);
    for (const candidate of result.candidates) {
      expect(candidate.evaluation.allowed).toBe(false);
      if (!candidate.evaluation.allowed) {
        expect(candidate.evaluation.blocks.length).toBeGreaterThan(0);
        for (const block of candidate.evaluation.blocks)
          expect(block.rule).toMatch(/^BR-(9|10|11)$/);
      }
    }
  });

  it('Fri C missed on Saturday: Saturday is offered (and Sunday is not)', () => {
    const result = listCandidates(contextAt('2026-11-28T07:00:00Z'), dayId(1, 5));
    if (!result.movable) throw new Error('expected movable');
    expect(result.recommendation).toBe('move');
    expect(result.candidates.map((c) => [c.date, c.evaluation.allowed])).toEqual([
      ['2026-11-28', true],
      ['2026-11-29', false],
    ]);
  });

  it('D22: candidates start today, never in the past', () => {
    const result = listCandidates(contextAt('2026-11-26T07:00:00Z'), dayId(1, 7));
    if (!result.movable) throw new Error('expected movable');
    expect(result.candidates.map((c) => c.date)).toEqual([
      '2026-11-26',
      '2026-11-27',
      '2026-11-28',
    ]);
  });

  it('BR-12: a session whose week is over has no candidates, so skip', () => {
    const result = listCandidates(contextAt('2026-12-01T07:00:00Z'), dayId(1, 3));
    expect(result).toEqual({ movable: true, candidates: [], recommendation: 'skip' });
  });

  it('says why a session cannot move at all', () => {
    expect(listCandidates(contextAt('2026-11-24T07:00:00Z'), dayId(1, 2))).toEqual({
      movable: false,
      reason: 'not_training',
    });
  });
});

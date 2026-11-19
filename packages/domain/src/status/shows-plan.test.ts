import { describe, expect, it } from 'vitest';
import { parseLocalDate } from '../time/local-date';
import type { SessionStatus } from './session-status';
import { showsPlan } from './shows-plan';

const d = parseLocalDate;
const TODAY = d('2026-11-25');
const STATUSES: SessionStatus[] = [
  'not_scheduled',
  'rest',
  'scheduled',
  'in_progress',
  'partial',
  'completed',
  'skipped',
  'missed',
];

describe('D58: showsPlan', () => {
  it('a past day never lists its targets, whatever its status', () => {
    for (const status of STATUSES) {
      expect(showsPlan({ date: d('2026-11-24'), status }, TODAY)).toBe(false);
    }
  });

  it('today and later list the plan until something is saved', () => {
    for (const date of [TODAY, d('2026-11-29')]) {
      expect(showsPlan({ date, status: 'scheduled' }, TODAY)).toBe(true);
      expect(showsPlan({ date, status: 'rest' }, TODAY)).toBe(true);
      expect(showsPlan({ date, status: 'in_progress' }, TODAY)).toBe(true);
      expect(showsPlan({ date, status: 'partial' }, TODAY)).toBe(false);
      expect(showsPlan({ date, status: 'completed' }, TODAY)).toBe(false);
    }
  });
});

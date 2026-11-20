import { describe, expect, it } from 'vitest';
import { editRunPath, newRunPath, runPath } from './paths';

describe('run paths (PRD §6.6)', () => {
  it('new, with or without a day; a run; its edit page', () => {
    expect(newRunPath()).toBe('/train/run/new');
    expect(newRunPath('2026-11-29')).toBe('/train/run/new?date=2026-11-29');
    expect(runPath('r-1')).toBe('/train/run/r-1');
    expect(editRunPath('r-1')).toBe('/train/run/r-1/edit');
  });
});

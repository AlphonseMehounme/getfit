// @vitest-environment jsdom
import type { LocalDate, Prescription } from '@getfit/domain';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { WorkoutView } from '@/server/services/workout';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { WorkoutRecord } from './workout-record';

const rx = (exerciseId: string, overrides: Partial<Prescription> = {}): Prescription => ({
  templateExerciseId: `te-${exerciseId}`,
  exerciseId,
  sequence: 1,
  sets: 2,
  target: { kind: 'reps', reps: 6 },
  perSide: false,
  restS: 120,
  overridden: false,
  ...overrides,
});

const set = (
  exerciseId: string,
  setNumber: number,
  side: 'left' | 'right' | 'both',
  value: { reps?: number; s?: number },
) => ({
  id: `${exerciseId}-${setNumber}-${side}`,
  exerciseId,
  substitutedForExerciseId: null,
  setNumber,
  side,
  actualReps: value.reps ?? null,
  actualDurationS: value.s ?? null,
  loadKg: null,
  rir: null,
  completed: true,
  loggedAt: new Date('2026-11-23T07:10:00Z'),
});

const WORKOUT: WorkoutView & { status: 'completed' | 'partial' } = {
  sessionId: 's-1',
  title: 'Strength C — Upper body',
  status: 'partial',
  scheduledDate: '2026-11-27' as LocalDate,
  startedAt: new Date('2026-11-27T07:00:00Z'),
  pausedAt: null,
  snapshot: {} as WorkoutView['snapshot'],
  exercises: [
    {
      slug: 'pull-up',
      category: 'upper',
      name: 'Pull-up',
      cues: [],
      prescription: rx('pull-up'),
      substitutes: [],
      activeSubstituteId: null,
    },
    {
      slug: 'side-plank',
      category: 'core',
      name: 'Side plank',
      cues: [],
      prescription: rx('side-plank', {
        sequence: 2,
        sets: 1,
        target: { kind: 'duration', seconds: 30 },
        perSide: true,
      }),
      substitutes: [],
      activeSubstituteId: null,
    },
  ],
  sets: [set('pull-up', 1, 'both', { reps: 5 }), set('side-plank', 1, 'left', { s: 30 })],
  progress: { prescribed: 4, logged: 2, complete: false },
  finishOptions: ['partial'],
  totals: { sets: 2, reps: 5, holdSeconds: 30 },
  activeSecondsNow: 0,
  durationS: 1500,
  completedAt: new Date('2026-11-27T07:25:00Z'),
  rpe: null,
  notes: null,
};

describe('WorkoutRecord', () => {
  it('BR-25 / BR-24: shows each logged set, says which were not logged, and no invented effort', async () => {
    const { container } = renderWithIntl(<WorkoutRecord workout={WORKOUT} backHref="/today" />);
    expect(screen.getByRole('heading', { level: 1, name: 'Strength C — Upper body' })).toBeTruthy();
    expect(screen.getByText('Friday, November 27 · Partly done')).toBeTruthy();
    expect(screen.getByText('2 of 4 sets logged')).toBeTruthy();
    expect(screen.getByText('Duration 25:00')).toBeTruthy();
    expect(screen.getByText('Effort —')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Notes' })).toBeNull();

    const pullUp = screen.getByRole('region', { name: 'Pull-up' });
    expect(pullUp.textContent).toContain('Set 15 reps');
    expect(pullUp.textContent).toContain('Set 2Not logged');
    const plank = screen.getByRole('region', { name: 'Side plank' });
    expect(plank.textContent).toContain('Set 1 · left30 s');
    expect(plank.textContent).toContain('Set 1 · rightNot logged');
    expect(screen.getByRole('link', { name: 'Back to Today' }).getAttribute('href')).toBe('/today');
    await expectNoAxeViolations(container);
  });

  it('shows a completed workout’s effort and notes; no date or duration reads as such, never 0', () => {
    renderWithIntl(
      <WorkoutRecord
        workout={{
          ...WORKOUT,
          status: 'completed',
          rpe: 7,
          notes: 'Felt strong',
          scheduledDate: null,
          durationS: null,
        }}
        backHref="/today"
      />,
    );
    expect(screen.getByText('Completed')).toBeTruthy();
    expect(screen.getByText('Effort 7/10')).toBeTruthy();
    expect(screen.getByText('Felt strong')).toBeTruthy();
    expect(screen.getByText('Duration —')).toBeTruthy();
  });
});

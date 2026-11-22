// @vitest-environment jsdom
import { parseLocalDate, type Prescription } from '@getfit/domain';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ExerciseCard } from '@/components/exercise/exercise-card';
import { WeekDayRow } from '@/components/programme/week-day-row';
import { ExerciseStep } from '@/components/workout/exercise-step';
import { resolveExerciseMedia } from '@/lib/media/resolve';
import type { WeekSession } from '@/server/services/programme-week';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { type DecideSuggestion, SuggestionCard } from './suggestion-card';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const reps = {
  kind: 'reps' as const,
  templateExerciseId: 'te-pull',
  fromReps: 6,
  toReps: 7,
  fromWeek: 2,
  exercise: 'Pull-up',
  session: 'Strength A — Upper body',
  sets: 3,
  perSide: false,
};
const card = (overrides: Partial<Parameters<typeof SuggestionCard>[0]> = {}) => (
  <SuggestionCard
    suggestion={reps}
    decision={null}
    open
    units="metric"
    decide={vi.fn<DecideSuggestion>(async () => ({ ok: true }))}
    {...overrides}
  />
);

describe('SuggestionCard (BR-19, D79, D80)', () => {
  it('describes the change and accepts it once, then refreshes', async () => {
    const decide = vi.fn<DecideSuggestion>(async () => ({ ok: true }));
    const { container } = renderWithIntl(card({ decide }));
    expect(
      screen.getByText('Pull-up in Strength A — Upper body: 3 × 7 instead of 3 × 6, from week 2.'),
    ).toBeTruthy();
    expect(
      screen.getByText('Nothing changes unless you accept it. Your answer is final.'),
    ).toBeTruthy();
    await expectNoAxeViolations(container);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(decide).toHaveBeenCalledWith('accepted');
  });

  it('declines; a closed window and a failure say so', async () => {
    const decide = vi.fn<DecideSuggestion>(async () => ({ ok: false, error: 'closed' }));
    renderWithIntl(card({ decide }));
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Decline' }));
    expect(decide).toHaveBeenCalledWith('declined');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'This review has closed, so it can’t be answered.',
    );
    decide.mockResolvedValueOnce({ ok: false, error: 'failed' });
    await user.click(screen.getByRole('button', { name: 'Accept' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'Your answer couldn’t be saved. Try again.',
      ),
    );
  });

  it.each([
    ['accepted', 'Accepted: it applies from week 2.'],
    ['declined', 'Declined: nothing changes.'],
    ['withdrawn', 'Withdrawn because you reported pain: nothing changes.'],
  ] as const)('D79 / D80: %s is final, with no buttons', (decision, text) => {
    renderWithIntl(card({ decision }));
    expect(screen.getByText(text)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('closed without an answer: nothing changed', () => {
    renderWithIntl(card({ open: false }));
    expect(screen.getByText('Not answered: nothing changed.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('a long-run ceiling in km or mi, and per side', () => {
    const longRun = { kind: 'long_run' as const, fromM: 11_000, toM: 12_000, fromWeek: 3 };
    const { unmount } = renderWithIntl(card({ suggestion: longRun }));
    expect(screen.getByText('Long run: up to 12 km instead of 11 km, from week 3.')).toBeTruthy();
    unmount();
    const { unmount: again } = renderWithIntl(
      card({ suggestion: longRun, units: 'imperial' }),
      'fr',
    );
    // PRD §9: numbers in the locale's format ("7,5" in French).
    expect(
      screen.getByText(
        'Sortie longue : jusqu’à 7,5 mi au lieu de 6,8 mi, à partir de la semaine 3.',
      ),
    ).toBeTruthy();
    again();
    renderWithIntl(
      card({ suggestion: { ...reps, perSide: true, exercise: 'Bulgarian split squat' } }),
    );
    expect(screen.getByText(/3 × 7 per side instead of 3 × 6/)).toBeTruthy();
  });
});

describe('BR-19: a progressed target says so', () => {
  const progressed: Prescription = {
    templateExerciseId: 'te-pull',
    exerciseId: 'ex-pull',
    sequence: 1,
    sets: 3,
    target: { kind: 'reps', reps: 7 },
    perSide: false,
    restS: 120,
    overridden: true,
  };

  it('on an exercise card', () => {
    renderWithIntl(
      <ExerciseCard
        name="Pull-up"
        target="3 × 7"
        progressed
        media={resolveExerciseMedia('pull-up', 'upper', 'en')}
      />,
    );
    expect(within(screen.getByRole('article')).getByText('Progressed')).toBeTruthy();
  });

  it('in the week view', async () => {
    const session: WeekSession = {
      programmeDayId: '00000000-0000-4000-8000-000000000001',
      title: 'Strength A — Upper body',
      sessionType: 'strength',
      bodyFocus: 'upper',
      status: 'scheduled',
      plannedDate: parseLocalDate('2026-11-30'),
      date: parseLocalDate('2026-11-30'),
      movedFrom: null,
      prescriptions: [progressed],
      exercises: [
        { slug: 'pull-up', category: 'upper', name: 'Pull-up', cues: [], prescription: progressed },
      ],
      showsPlan: true,
      workoutSessionId: null,
      runSessionId: null,
      canLogRun: false,
      canMove: true,
      canSkip: true,
      canUndo: false,
    };
    const { container } = renderWithIntl(
      <ul>
        <WeekDayRow
          date={parseLocalDate('2026-11-30')}
          isToday
          sessions={[session]}
          units="metric"
        />
      </ul>,
      'fr',
    );
    expect(screen.getByText('Progression')).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('on the workout screen', () => {
    renderWithIntl(
      <ExerciseStep
        name="Pull-up"
        media={resolveExerciseMedia('pull-up', 'upper', 'en')}
        target="3 × 7"
        progressed
        cues={[]}
        index={0}
        total={5}
      >
        <p>sets</p>
      </ExerciseStep>,
    );
    expect(screen.getByText('Progressed')).toBeTruthy();
  });
});

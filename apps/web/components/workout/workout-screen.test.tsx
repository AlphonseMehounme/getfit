// @vitest-environment jsdom
import '@/test/dialog-shim';
import type { Prescription } from '@getfit/domain';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { type LogSetAction, WorkoutScreen, type WorkoutScreenExercise } from './workout-screen';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

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

const EXERCISES: WorkoutScreenExercise[] = [
  {
    name: 'Pull-up',
    cues: ['Hang from the bar.', 'Pull your chest to the bar.'],
    media: { kind: 'fallback', category: 'upper' },
    prescription: rx('pull-up'),
  },
  {
    name: 'Side plank',
    cues: [],
    media: { kind: 'fallback', category: 'core' },
    prescription: rx('side-plank', {
      sequence: 2,
      sets: 1,
      target: { kind: 'duration', seconds: 30 },
      perSide: true,
    }),
  },
];

const SESSION = '3f1d2c3e-0000-4000-8000-000000000001';

function renderScreen(
  logSet: LogSetAction,
  initialIndex = 0,
  initialSets: Record<string, { id: string; value: number }> = {
    'pull-up|1|both': { id: 'set-1', value: 6 },
  },
) {
  return renderWithIntl(
    <WorkoutScreen
      sessionId={SESSION}
      title="Strength A — Upper body"
      exercises={EXERCISES}
      initialSets={initialSets}
      initialIndex={initialIndex}
      logSet={logSet}
      exitHref="/today"
    />,
  );
}

describe('WorkoutScreen', () => {
  it('PRD §6.5: one exercise per screen, its target large, sets logged so far, and axe clean', async () => {
    const { container } = renderScreen(vi.fn());
    expect(screen.getByRole('heading', { level: 1, name: 'Strength A — Upper body' })).toBeTruthy();
    expect(screen.getByText('Exercise 1 of 2')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Pull-up' })).toBeTruthy();
    expect(screen.getByText('2 × 6').className).toContain('text-4xl');
    expect(screen.getByText('Pull your chest to the bar.')).toBeTruthy();
    expect(screen.getByText('1 of 4 sets done')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('All sets saved');
    expect(screen.getByText('Set 1: done, 6 reps')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Set 2' })).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('D21: logs a set with its slot and a client ID, and keeps that ID for an edit', async () => {
    const logSet = vi.fn<LogSetAction>(async () => ({ ok: true }));
    renderScreen(logSet);
    await userEvent.click(screen.getByRole('button', { name: 'Done as planned' }));
    await waitFor(() => expect(screen.getByText('2 of 4 sets done')).toBeTruthy());
    const first = logSet.mock.calls[0]![0];
    expect(first).toMatchObject({
      sessionId: SESSION,
      exerciseId: 'pull-up',
      setNumber: 2,
      side: 'both',
      actualReps: 6,
      actualDurationS: null,
      completed: true,
    });
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('All sets saved'));

    await userEvent.click(screen.getByRole('button', { name: 'Edit Set 2' }));
    await userEvent.click(screen.getByRole('button', { name: 'Decrease Reps for Set 2' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save 5 reps' }));
    await waitFor(() => expect(logSet).toHaveBeenCalledTimes(2));
    expect(logSet.mock.calls[1]![0]).toMatchObject({ id: first.id, actualReps: 5 });
  });

  it('asks before the page is closed only while a set is still being saved', async () => {
    let resolve: (value: { ok: boolean }) => void = () => {};
    const logSet = vi.fn<LogSetAction>(() => new Promise((r) => (resolve = r)));
    renderScreen(logSet);
    const unload = () => {
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      return event.defaultPrevented;
    };
    expect(unload()).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Done as planned' }));
    expect(unload()).toBe(true);
    await act(async () => resolve({ ok: true }));
    expect(unload()).toBe(false);
  });

  it('says nothing about saving before the first set', () => {
    renderScreen(vi.fn(), 0, {});
    expect(screen.getByText('0 of 4 sets done')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('');
  });

  it('says it is saving while a set is on its way', async () => {
    let resolve: (value: { ok: boolean }) => void = () => {};
    const logSet = vi.fn<LogSetAction>(() => new Promise((r) => (resolve = r)));
    renderScreen(logSet);
    await userEvent.click(screen.getByRole('button', { name: 'Done as planned' }));
    expect(screen.getByRole('status').textContent).toBe('Saving…');
    await act(async () => resolve({ ok: true }));
    expect(screen.getByRole('status').textContent).toBe('All sets saved');
  });

  it('rolls a set back and says so when it could not be saved, or when an edit fails', async () => {
    const logSet = vi
      .fn<LogSetAction>()
      .mockResolvedValueOnce({ ok: false })
      .mockRejectedValueOnce(new Error('offline'));
    renderScreen(logSet);
    await userEvent.click(screen.getByRole('button', { name: 'Done as planned' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'This set could not be saved. Check your connection and try again.',
      ),
    );
    expect(screen.getByText('1 of 4 sets done')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Set 2' })).toBeTruthy();

    // An edit that fails keeps the value that was saved before.
    await userEvent.click(screen.getByRole('button', { name: 'Edit Set 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Increase Reps for Set 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save 7 reps' }));
    await waitFor(() => expect(screen.getByText('Set 1: done, 6 reps')).toBeTruthy());
  });

  it('BR-16: moves between exercises; a per-side hold has a row per side and logs seconds', async () => {
    const logSet = vi.fn<LogSetAction>(async () => ({ ok: true }));
    renderScreen(logSet);
    expect((screen.getByRole('button', { name: 'Previous' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Side plank' })).toBeTruthy();
    expect(screen.getByText('30 s per side')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Set 1 · left' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Set 1 · right' })).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Next' }) as HTMLButtonElement).disabled).toBe(true);

    const [left] = screen.getAllByRole('button', { name: 'Done as planned' });
    await userEvent.click(left!);
    await waitFor(() => expect(logSet).toHaveBeenCalled());
    expect(logSet.mock.calls[0]![0]).toMatchObject({
      exerciseId: 'side-plank',
      side: 'left',
      actualReps: null,
      actualDurationS: 30,
    });

    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Pull-up' })).toBeTruthy();
  });

  it('opens the exercise list to jump, and leaves through the Leave dialog', async () => {
    renderScreen(vi.fn(), 1);
    expect(screen.getByRole('heading', { level: 2, name: 'Side plank' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Exercises' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Exercises' }));
    await userEvent.click(screen.getByRole('button', { name: /Pull-up/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'Pull-up' })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Leave' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep going' }));
    await userEvent.click(screen.getByRole('button', { name: 'Leave' }));
    await userEvent.click(screen.getByRole('button', { name: 'Leave and resume later' }));
    expect(push).toHaveBeenCalledWith('/today');
  });
});

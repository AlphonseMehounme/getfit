// @vitest-environment jsdom
import '@/test/dialog-shim';
import type { Prescription } from '@getfit/domain';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PauseAction } from '@/lib/hooks/use-workout-pause';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import type { FinishAction } from './finish-summary';
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
  finish: FinishAction = vi.fn<FinishAction>(async () => ({ ok: true })),
  pauseProps: { pause?: PauseAction; resume?: PauseAction; pausedAtLoad?: boolean } = {},
) {
  return renderWithIntl(
    <WorkoutScreen
      sessionId={SESSION}
      title="Strength A — Upper body"
      exercises={EXERCISES}
      initialSets={initialSets}
      initialIndex={initialIndex}
      logSet={logSet}
      finish={finish}
      pause={pauseProps.pause ?? vi.fn<PauseAction>(async () => ({ ok: true }))}
      resume={pauseProps.resume ?? vi.fn<PauseAction>(async () => ({ ok: true }))}
      pausedAtLoad={pauseProps.pausedAtLoad}
      activeSecondsAtLoad={600}
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
    // On the last exercise, Next becomes Finish.
    expect(screen.queryByRole('button', { name: 'Next' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Finish' })).toBeTruthy();

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

  it('PRD §6.5: Finish opens the summary with the same totals the server uses, and saves (D31)', async () => {
    const finish = vi.fn<FinishAction>(async () => ({ ok: true }));
    const all = {
      'pull-up|1|both': { id: 'a', value: 6 },
      'pull-up|2|both': { id: 'b', value: 5 },
      'side-plank|1|left': { id: 'c', value: 30 },
      'side-plank|1|right': { id: 'd', value: 28 },
    };
    renderScreen(vi.fn(), 1, all, finish);
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(screen.getByRole('heading', { name: 'Finish the workout' })).toBeTruthy();
    expect(screen.queryByRole('heading', { level: 2, name: 'Side plank' })).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Exercises' })).toBeNull();
    expect(screen.getByText('4 of 4 sets logged')).toBeTruthy();
    expect(screen.getByText('11 reps in total')).toBeTruthy();
    expect(screen.getByText('58 s held')).toBeTruthy();
    expect(screen.getByText(/Duration 10:0\d/)).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Back to the workout' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Side plank' })).toBeTruthy();

    await userEvent.click(screen.getByRole('button', { name: 'Exercises' }));
    await userEvent.click(screen.getByRole('button', { name: 'Finish workout' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save as completed' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/today'));
    expect(finish).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: SESSION, save: 'completed' }),
    );
  });

  it('choosing an exercise from the list leaves the summary', async () => {
    renderScreen(vi.fn(), 1);
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await userEvent.click(screen.getByRole('button', { name: 'Exercises' }));
    await userEvent.click(screen.getByRole('button', { name: /Pull-up/ }));
    expect(screen.getByRole('heading', { level: 2, name: 'Pull-up' })).toBeTruthy();
  });

  it('PRD §5.2: the Leave dialog saves as partial and goes to Today, or stays when it fails', async () => {
    push.mockClear();
    const finish = vi
      .fn<FinishAction>()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });
    renderScreen(vi.fn(), 0, undefined, finish);
    await userEvent.click(screen.getByRole('button', { name: 'Leave' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save as partial' }));
    await waitFor(() =>
      expect(screen.getByText('The workout could not be saved. Please try again.')).toBeTruthy(),
    );
    expect(push).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Save as partial' }));
    await waitFor(() => expect(push).toHaveBeenCalledWith('/today'));
    expect(finish).toHaveBeenLastCalledWith({
      sessionId: SESSION,
      save: 'partial',
      confirm: true,
      rpe: null,
      notes: null,
    });
  });
});

describe('WorkoutScreen rest timer (D39, D43, D47, D48)', () => {
  const KEY = `getfit.rest.${SESSION}`;
  const timer = () => screen.queryByRole('timer', { name: 'Rest time left' });
  const storeRest = (inS: number, totalS = 120) =>
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ endsAt: new Date(Date.now() + inS * 1000).toISOString(), totalS }),
    );

  // Earlier tests leave rests behind for the same session, as a real device would.
  beforeEach(() => window.localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it("D39: a set's first log starts the prescription's rest; Skip and +15 s act on it", async () => {
    const logSet = vi.fn<LogSetAction>(async () => ({ ok: true }));
    const { container } = renderScreen(logSet);
    expect(timer()).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Done as planned' }));
    expect(timer()!.textContent).toMatch(/^(2:00|1:59)$/);
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toMatchObject({ totalS: 120 });
    await expectNoAxeViolations(container);

    // +15 s moves the end time by exactly 15 s, whatever time the test itself took.
    const stored = () => JSON.parse(window.localStorage.getItem(KEY)!) as { endsAt: string };
    const before = Date.parse(stored().endsAt);
    await userEvent.click(screen.getByRole('button', { name: '+15 s: add 15 seconds of rest' }));
    expect(Date.parse(stored().endsAt) - before).toBe(15_000);
    expect(JSON.parse(window.localStorage.getItem(KEY)!)).toMatchObject({ totalS: 135 });
    await userEvent.click(screen.getByRole('button', { name: 'Skip rest' }));
    expect(timer()).toBeNull();
    expect(window.localStorage.getItem(KEY)).toBeNull();
  });

  it('D47: correcting a logged set never starts a rest', async () => {
    renderScreen(vi.fn<LogSetAction>(async () => ({ ok: true })));
    await userEvent.click(screen.getByRole('button', { name: 'Edit Set 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Increase Reps for Set 1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save 7 reps' }));
    await waitFor(() => expect(screen.getByText('Set 1: done, 7 reps')).toBeTruthy());
    expect(timer()).toBeNull();
  });

  it('D43: no rest after the left side, nor after the last set of the workout', async () => {
    renderScreen(
      vi.fn<LogSetAction>(async () => ({ ok: true })),
      1,
      {},
    );
    const [left] = screen.getAllByRole('button', { name: 'Done as planned' });
    await userEvent.click(left!);
    expect(timer()).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Done as planned' }));
    await waitFor(() => expect(screen.getByText('2 of 4 sets done')).toBeTruthy());
    expect(timer()).toBeNull();
  });

  it('D48: a running rest comes back after a reload; an ended or unreadable one does not', () => {
    storeRest(90);
    const first = renderScreen(vi.fn());
    expect(timer()!.textContent).toMatch(/^1:(30|29)$/);
    first.unmount();

    storeRest(-5);
    const ended = renderScreen(vi.fn());
    expect(timer()).toBeNull();
    ended.unmount();

    window.localStorage.setItem(KEY, '{not json');
    const broken = renderScreen(vi.fn());
    expect(timer()).toBeNull();
    broken.unmount();

    window.localStorage.setItem(KEY, JSON.stringify({ endsAt: 'soon', totalS: 60 }));
    renderScreen(vi.fn());
    expect(timer()).toBeNull();
  });

  it('D39: announces the end of the rest in a live region that stays on screen', async () => {
    storeRest(1);
    renderScreen(vi.fn());
    expect(timer()).toBeTruthy();
    await waitFor(() => expect(timer()).toBeNull(), { timeout: 3000 });
    expect(
      screen
        .getByText('Rest over. Start the next set when you are ready.')
        .getAttribute('aria-live'),
    ).toBe('polite');
  });

  it('D48: with storage blocked the rest still runs, it just is not kept', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('SecurityError');
    });
    renderScreen(vi.fn<LogSetAction>(async () => ({ ok: true })));
    await userEvent.click(screen.getByRole('button', { name: 'Done as planned' }));
    expect(timer()!.textContent).toMatch(/^(2:00|1:59)$/);
  });

  it('D46: announces where a hold ended', async () => {
    renderScreen(vi.fn(), 1, {});
    const [startLeft] = screen.getAllByRole('button', { name: /^Start the hold/ });
    await userEvent.click(startLeft!);
    await userEvent.click(screen.getByRole('button', { name: 'Stop' }));
    expect(screen.getByText('Hold ended at 0 s. Check the value, then save the set.')).toBeTruthy();
  });
});

describe('WorkoutScreen pause (D34, D45, D50)', () => {
  beforeEach(() => window.localStorage.clear());

  const dialog = () => screen.queryByRole('dialog', { name: 'Workout paused' });

  it('D34: Pause persists, covers the controls with the time stopped, and Resume goes back', async () => {
    const pause = vi.fn<PauseAction>(async () => ({ ok: true }));
    const resume = vi.fn<PauseAction>(async () => ({ ok: true }));
    const { container } = renderScreen(vi.fn(), 0, undefined, undefined, { pause, resume });
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(pause).toHaveBeenCalledWith({ sessionId: SESSION });
    expect(dialog()).toBeTruthy();
    expect(screen.getByText(/^10:0\d so far$/)).toBeTruthy();
    await expectNoAxeViolations(container);

    await userEvent.click(screen.getByRole('button', { name: 'Resume' }));
    await waitFor(() => expect(dialog()).toBeNull());
    expect(resume).toHaveBeenCalledTimes(1);
  });

  it('D34: a workout paused when the page loaded opens paused', () => {
    renderScreen(vi.fn(), 0, undefined, undefined, { pausedAtLoad: true });
    expect(dialog()).toBeTruthy();
    expect(screen.getByText('10:00 so far')).toBeTruthy();
  });

  it('D50: pausing ends a running rest, with no announcement', async () => {
    renderScreen(vi.fn<LogSetAction>(async () => ({ ok: true })));
    await userEvent.click(screen.getByRole('button', { name: 'Done as planned' }));
    expect(screen.getByRole('timer', { name: 'Rest time left' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(screen.queryByRole('timer', { name: 'Rest time left' })).toBeNull();
    expect(screen.queryByText(/Rest over/)).toBeNull();
  });

  it('a refused pause goes back and says so; a refused resume stays paused and says so', async () => {
    const pause = vi.fn<PauseAction>().mockResolvedValueOnce({ ok: false });
    const resume = vi.fn<PauseAction>().mockRejectedValueOnce(new Error('offline'));
    renderScreen(vi.fn(), 0, undefined, undefined, { pause, resume });
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(() =>
      expect(
        screen.getByText('The workout could not be paused. Check your connection and try again.'),
      ).toBeTruthy(),
    );
    expect(dialog()).toBeNull();

    pause.mockResolvedValueOnce({ ok: true });
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    await userEvent.click(screen.getByRole('button', { name: 'Resume' }));
    await waitFor(() =>
      expect(
        screen.getByText('The workout could not be resumed. Check your connection and try again.'),
      ).toBeTruthy(),
    );
    expect(dialog()).toBeTruthy();
  });

  it('PRD §9: the wake lock is released while paused', async () => {
    const release = vi.fn(async () => undefined);
    const request = vi.fn(async () => ({ released: false, release }));
    Object.defineProperty(navigator, 'wakeLock', { value: { request }, configurable: true });
    renderScreen(vi.fn());
    await waitFor(() => expect(request).toHaveBeenCalled());
    await userEvent.click(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(() => expect(release).toHaveBeenCalled());
    // @ts-expect-error removing the test double
    delete navigator.wakeLock;
  });
});

describe('WorkoutScreen skip (D40, D49, D31)', () => {
  beforeEach(() => window.localStorage.clear());

  it('D40: Skip hides the open sets, Undo brings them back', async () => {
    const { container } = renderScreen(vi.fn());
    await userEvent.click(screen.getByRole('button', { name: 'Skip exercise: Pull-up' }));
    expect(screen.queryByRole('group', { name: 'Set 2' })).toBeNull();
    expect(
      screen.getByText(
        'Skipped. Its sets stay unlogged, so this workout can only be saved as partial.',
      ),
    ).toBeTruthy();
    // The set already logged stays logged.
    expect(screen.getByText('1 of 4 sets done')).toBeTruthy();
    await expectNoAxeViolations(container);
    await userEvent.click(screen.getByRole('button', { name: 'Undo skip: Pull-up' }));
    expect(screen.getByRole('group', { name: 'Set 2' })).toBeTruthy();
    expect(window.localStorage.getItem(`getfit.skipped.${SESSION}`)).toBeNull();
  });

  it('D49 / D31: a skip survives a reload and the summary lists it, with only partial offered', async () => {
    const first = renderScreen(vi.fn());
    await userEvent.click(screen.getByRole('button', { name: 'Skip exercise: Pull-up' }));
    first.unmount();

    renderScreen(vi.fn(), 1, {
      'pull-up|1|both': { id: 'set-1', value: 6 },
      'side-plank|1|left': { id: 'c', value: 30 },
      'side-plank|1|right': { id: 'd', value: 30 },
    });
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }));
    expect(screen.getByText('Skipped: Pull-up')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save as completed' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Save as partial' })).toBeTruthy();
  });

  it('an exercise with every set logged offers no skip', () => {
    renderScreen(vi.fn(), 0, {
      'pull-up|1|both': { id: 'a', value: 6 },
      'pull-up|2|both': { id: 'b', value: 6 },
    });
    expect(screen.queryByRole('button', { name: 'Skip exercise: Pull-up' })).toBeNull();
  });
});

describe('WorkoutScreen substitutes (D40, D44) and load (D41)', () => {
  beforeEach(() => window.localStorage.clear());

  const crunch = {
    id: 'abdominal-crunch',
    name: 'Abdominal crunch',
    cues: ['Curl your shoulders off the floor.'],
    media: { kind: 'fallback', category: 'core' } as const,
  };
  const withSubstitutes = (activeSubstituteId: string | null = null): WorkoutScreenExercise[] => [
    EXERCISES[0]!,
    { ...EXERCISES[1]!, substitutes: [crunch], activeSubstituteId },
  ];

  function renderWith(exercises: WorkoutScreenExercise[], logSet: LogSetAction) {
    return renderWithIntl(
      <WorkoutScreen
        sessionId={SESSION}
        title="Strength C"
        exercises={exercises}
        initialSets={{}}
        initialIndex={1}
        logSet={logSet}
        finish={vi.fn<FinishAction>(async () => ({ ok: true }))}
        pause={vi.fn<PauseAction>(async () => ({ ok: true }))}
        resume={vi.fn<PauseAction>(async () => ({ ok: true }))}
        loadUnit="lb"
        activeSecondsAtLoad={0}
        exitHref="/today"
      />,
    );
  }

  it('D40: a substitute replaces the exercise for the rest of the workout and fills its slots', async () => {
    const logSet = vi.fn<LogSetAction>(async () => ({ ok: true }));
    const { container } = renderWith(withSubstitutes(), logSet);
    await userEvent.click(screen.getByRole('button', { name: 'Substitute: Side plank' }));
    expect(screen.getByRole('dialog', { name: 'Substitute Side plank' })).toBeTruthy();
    await expectNoAxeViolations(container);
    await userEvent.click(screen.getByRole('button', { name: 'Abdominal crunch' }));

    expect(screen.getByRole('heading', { level: 2, name: 'Abdominal crunch' })).toBeTruthy();
    expect(screen.getByText('Instead of Side plank')).toBeTruthy();
    expect(screen.getByText('Curl your shoulders off the floor.')).toBeTruthy();
    // The prescription's target stays (D40).
    expect(screen.getByText('30 s per side')).toBeTruthy();
    const [left] = screen.getAllByRole('button', { name: 'Done as planned' });
    await userEvent.click(left!);
    await waitFor(() => expect(logSet).toHaveBeenCalled());
    expect(logSet.mock.calls[0]![0]).toMatchObject({
      exerciseId: 'abdominal-crunch',
      substitutedForExerciseId: 'side-plank',
      side: 'left',
      actualDurationS: 30,
      loadUnit: 'lb',
    });

    // Back to the prescribed exercise.
    await userEvent.click(screen.getByRole('button', { name: 'Substitute: Side plank' }));
    expect(
      screen.getByRole('button', { name: 'Abdominal crunch' }).getAttribute('aria-pressed'),
    ).toBe('true');
    await userEvent.click(screen.getByRole('button', { name: 'Back to Side plank' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Side plank' })).toBeTruthy();
    expect(screen.queryByText('Instead of Side plank')).toBeNull();
  });

  it('D44: opens with the substitute of the last logged set; the sheet can be closed', async () => {
    renderWith(withSubstitutes('abdominal-crunch'), vi.fn());
    expect(screen.getByRole('heading', { level: 2, name: 'Abdominal crunch' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Substitute: Side plank' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog', { name: 'Substitute Side plank' })).toBeNull();
  });

  it('no Substitute without substitutes', () => {
    renderWith([EXERCISES[0]!, { ...EXERCISES[1]!, substitutes: [] }], vi.fn());
    expect(screen.queryByRole('button', { name: /^Substitute/ })).toBeNull();
  });

  it('D41: load and RIR go with the set, in the user unit', async () => {
    const logSet = vi.fn<LogSetAction>(async () => ({ ok: true }));
    renderWith(withSubstitutes(), logSet);
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Load and reps in reserve for Set 1' }),
    );
    await userEvent.type(screen.getByLabelText('Load (lb)'), '10');
    await userEvent.selectOptions(screen.getByLabelText('Reps in reserve'), '2');
    const [done] = screen.getAllByRole('button', { name: 'Done as planned' });
    await userEvent.click(done!);
    await waitFor(() => expect(logSet).toHaveBeenCalled());
    expect(logSet.mock.calls[0]![0]).toMatchObject({
      exerciseId: 'pull-up',
      substitutedForExerciseId: null,
      load: 10,
      loadUnit: 'lb',
      rir: 2,
    });
    await waitFor(() =>
      expect(screen.getByText('Set 1: done, 6 reps · 10 lb · RIR 2')).toBeTruthy(),
    );
  });
});

describe('WorkoutScreen through the outbox (P4-05, D89)', () => {
  const ALL = {
    'pull-up|1|both': { id: 'a', value: 6 },
    'pull-up|2|both': { id: 'b', value: 5 },
    'side-plank|1|left': { id: 'c', value: 30 },
    'side-plank|1|right': { id: 'd', value: 28 },
  };
  const syncProps = (overrides = {}) => ({
    status: 'saved' as const,
    notice: null,
    onRetry: vi.fn(),
    ...overrides,
  });

  it('shows the indicator in place of the saving line, with its retry', async () => {
    const sync = syncProps({ status: 'failed' });
    renderWithIntl(
      <WorkoutScreen
        sessionId={SESSION}
        title="Strength A"
        exercises={EXERCISES}
        initialSets={{}}
        initialIndex={0}
        logSet={vi.fn()}
        finish={vi.fn()}
        pause={vi.fn()}
        resume={vi.fn()}
        activeSecondsAtLoad={0}
        exitHref="/today"
        sync={sync}
      />,
    );
    expect(screen.getByRole('status').textContent).toBe('Not synced');
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(sync.onRetry).toHaveBeenCalled();
  });

  it.each([
    [
      { id: SESSION, status: 'refused', reason: 'kept_unlinked' },
      /already logged on another device/,
    ],
    [{ id: SESSION, status: 'conflict' }, /couldn’t be applied/],
  ] as const)('D90 / D91: a write the server kept apart is said, in amber', (notice, message) => {
    renderWithIntl(
      <WorkoutScreen
        sessionId={SESSION}
        title="Strength A"
        exercises={EXERCISES}
        initialSets={{}}
        initialIndex={0}
        logSet={vi.fn()}
        finish={vi.fn()}
        pause={vi.fn()}
        resume={vi.fn()}
        activeSecondsAtLoad={0}
        exitHref="/today"
        sync={syncProps({ notice })}
      />,
    );
    expect(screen.getByText('Synced, with a change')).toBeTruthy();
    expect(screen.getByText(message)).toBeTruthy();
  });

  it('a finish waiting on the device stays here and says so, with the way back to Today', async () => {
    push.mockClear();
    const finish = vi.fn<FinishAction>(async () => ({ ok: true, synced: false }));
    const { container } = renderScreen(vi.fn(), 1, ALL, finish);
    await userEvent.click(screen.getByRole('button', { name: 'Finish' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save as completed' }));
    expect(await screen.findByText('Workout saved')).toBeTruthy();
    expect(screen.getByText(/Saved on this device. It will sync/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to Today' })).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
    await expectNoAxeViolations(container);
  });

  it('D104: a finish kept apart by the server says why', async () => {
    const finish = vi.fn<FinishAction>(async () => ({
      ok: true,
      synced: true,
      notice: { id: SESSION, status: 'refused', reason: 'kept_unlinked' },
    }));
    renderScreen(vi.fn(), 0, undefined, finish);
    await userEvent.click(screen.getByRole('button', { name: 'Leave' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save as partial' }));
    expect(await screen.findByText(/doesn’t count for its day/)).toBeTruthy();
  });
});

// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import '@/test/dialog-shim';
import type { Prescription } from '@getfit/domain';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PauseAction } from '@/lib/hooks/use-workout-pause';
import type { LogSetAction } from '@/lib/hooks/use-set-logging';
import { deleteOfflineDb, openOfflineDb } from '@/lib/offline/db';
import { saveWorkoutWrite } from '@/lib/offline/local-workout';
import type { Send } from '@/lib/offline/sync-client';
import { SyncProvider } from '@/lib/offline/sync-provider';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { DeviceWorkoutScreen } from './device-workout-screen';
import type { FinishAction } from './finish-summary';
import type { WorkoutScreenProps } from './workout-screen';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

const SESSION = '3f1d2c3e-0000-4000-8000-000000000001';
const NOW = new Date('2026-11-23T07:05:00Z');
let user = 0;
afterEach(async () => {
  vi.restoreAllMocks();
  push.mockReset();
  await deleteOfflineDb(`device-${user}`);
});

const rx = (exerciseId: string, sequence: number): Prescription => ({
  templateExerciseId: `te-${exerciseId}`,
  exerciseId,
  sequence,
  sets: 2,
  target: { kind: 'reps', reps: 6 },
  perSide: false,
  restS: 120,
  overridden: false,
});

function props(overrides: Partial<WorkoutScreenProps> = {}): WorkoutScreenProps {
  return {
    sessionId: SESSION,
    title: 'Strength A — Upper body',
    exercises: [
      {
        name: 'Pull-up',
        cues: [],
        media: { kind: 'fallback', category: 'upper' },
        prescription: rx('pull-up', 1),
      },
      {
        name: 'Push-up',
        cues: [],
        media: { kind: 'fallback', category: 'upper' },
        prescription: rx('push-up', 2),
      },
    ],
    initialSets: { 'pull-up|1|both': { id: 'set-1', value: 6 } },
    initialIndex: 0,
    logSet: vi.fn<LogSetAction>(async () => ({ ok: true })),
    finish: vi.fn<FinishAction>(async () => ({ ok: true })),
    pause: vi.fn<PauseAction>(async () => ({ ok: true })),
    resume: vi.fn<PauseAction>(async () => ({ ok: true })),
    activeSecondsAtLoad: 600,
    exitHref: '/today',
    ...overrides,
  };
}

/** A /api/sync that answers every write `applied`, or throws while offline. */
function fakeSend(offline = false) {
  return vi.fn<Send>(async (request) => {
    if (offline) throw new TypeError('Failed to fetch');
    return { results: request.writes.map((w) => ({ id: w.id, status: 'applied' as const })) };
  });
}

const doneAsPlanned = (set: string) =>
  within(screen.getByRole('group', { name: set })).getByRole('button', { name: 'Done as planned' });

const renderOnDevice = (screenProps: WorkoutScreenProps, send: Send) =>
  renderWithIntl(
    <SyncProvider userId={`device-${user}`} send={send}>
      <DeviceWorkoutScreen {...screenProps} />
    </SyncProvider>,
  );

/** What this device logged earlier and hasn't synced: set 2 and 3 of the workout, and a pause. */
async function leaveOnDevice() {
  const db = openOfflineDb(`device-${++user}`);
  const keep = (
    kind: 'set.upsert' | 'workout.pause',
    update: Parameters<typeof saveWorkoutWrite>[2],
  ) => saveWorkoutWrite(db, { sessionId: SESSION, kind, payload: {} }, update, NOW);
  await keep('set.upsert', (copy, writeId) => {
    copy.sets['pull-up|2|both'] = {
      id: 'set-2',
      value: 5,
      load: null,
      rir: null,
      substituteId: null,
      writeId,
    };
  });
  await keep('set.upsert', (copy, writeId) => {
    copy.sets['push-up|1|both'] = {
      id: 'set-3',
      value: 12,
      load: null,
      rir: null,
      substituteId: null,
      writeId,
    };
  });
  await keep('workout.pause', (copy, writeId) => {
    copy.pause = { paused: true, writeId };
  });
  db.close();
}

describe('DeviceWorkoutScreen (P4-05, D89, BR-6)', () => {
  it('outside the outbox, it is the online screen, with the server actions', async () => {
    const screenProps = props();
    renderWithIntl(<DeviceWorkoutScreen {...screenProps} />);
    expect(screen.getByRole('status').textContent).toBe('All sets saved');
    await userEvent.setup().click(doneAsPlanned('Set 2'));
    await waitFor(() => expect(screenProps.logSet).toHaveBeenCalled());
  });

  it('a reload offline: the device’s unsynced sets and pause go on top, and it reopens at the next open set', async () => {
    await leaveOnDevice();
    const { container } = renderOnDevice(props(), fakeSend(true));
    // Set 3 (push-up 1) was logged on the device: it reopens on the push-up, paused, as left (D34).
    expect(await screen.findByRole('heading', { level: 2, name: 'Push-up' })).toBeTruthy();
    expect(screen.getByText('3 of 4 sets done')).toBeTruthy();
    expect(screen.getByText('Set 1: done, 12 reps')).toBeTruthy();
    // The pause overlay is a dialog that opens in an effect, just after the first render.
    expect(await screen.findByRole('button', { name: 'Resume' })).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Saved on this device')).toBeTruthy());
    await expectNoAxeViolations(container);
  });

  it('every set logged on the device: it reopens on the last exercise', async () => {
    user++;
    const db = openOfflineDb(`device-${user}`);
    await saveWorkoutWrite(
      db,
      { sessionId: SESSION, kind: 'set.upsert', payload: {} },
      (copy, writeId) => {
        for (const key of ['pull-up|2|both', 'push-up|1|both', 'push-up|2|both']) {
          copy.sets[key] = {
            id: key,
            value: 6,
            load: null,
            rir: null,
            substituteId: null,
            writeId,
          };
        }
      },
      NOW,
    );
    db.close();
    renderOnDevice(props(), fakeSend(true));
    expect(await screen.findByText('4 of 4 sets done')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'Push-up' })).toBeTruthy();
  });

  it('a finish still waiting on the device shows the workout saved, with the way back to Today', async () => {
    user++;
    const db = openOfflineDb(`device-${user}`);
    await saveWorkoutWrite(
      db,
      { sessionId: SESSION, kind: 'workout.finish', payload: {} },
      (copy, writeId) => {
        copy.finish = { save: 'partial', writeId };
      },
      NOW,
    );
    db.close();
    renderOnDevice(props(), fakeSend(true));
    expect(await screen.findByText(/Saved on this device. It will sync/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to Today' }).getAttribute('href')).toBe('/today');
  });

  it('a set logged online goes through the outbox, not the server action, and shows Synced', async () => {
    user++;
    const send = fakeSend();
    const screenProps = props();
    renderOnDevice(screenProps, send);
    await waitFor(() => expect(screen.getByText('Synced')).toBeTruthy());
    await userEvent.setup().click(doneAsPlanned('Set 2'));
    await waitFor(() =>
      expect(send.mock.calls.flatMap(([r]) => r.writes.map((w) => w.kind))).toContain('set.upsert'),
    );
    expect(screenProps.logSet).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.getByText('Synced')).toBeTruthy());
    expect(screen.getByText('Set 2: done, 6 reps')).toBeTruthy();
  });
});

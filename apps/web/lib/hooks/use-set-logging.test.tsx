// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { type LogSetAction, useSetLogging } from './use-set-logging';

const SESSION = '3f1d2c3e-0000-4000-8000-000000000001';
const slot = { exerciseId: 'plank', setNumber: 1, side: 'both' } as const;

describe('useSetLogging', () => {
  it('D21: saves a set optimistically with one client ID per slot, reused for a retry', async () => {
    const logSet = vi
      .fn<LogSetAction>()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true });
    const { result } = renderHook(() => useSetLogging(SESSION, {}, logSet));

    await act(() => result.current.log(slot, 'seconds', 45));
    // BR-6: a refused save rolls back and says so.
    expect(result.current.failed).toBe(true);
    expect(result.current.sets).toEqual({});

    await act(() => result.current.log(slot, 'seconds', 40));
    expect(result.current.failed).toBe(false);
    expect(result.current.pending).toBe(0);
    expect(result.current.sets['plank|1|both']).toMatchObject({ value: 40 });
    const [first, retry] = logSet.mock.calls.map(([input]) => input);
    expect(retry!.id).toBe(first!.id);
    expect(retry).toMatchObject({
      sessionId: SESSION,
      actualReps: null,
      actualDurationS: 40,
      completed: true,
    });
  });

  it('BR-6: a failed edit keeps the value saved before', async () => {
    const logSet = vi.fn<LogSetAction>().mockRejectedValueOnce(new Error('offline'));
    const { result } = renderHook(() =>
      useSetLogging(SESSION, { 'plank|1|both': { id: 'set-1', value: 45 } }, logSet),
    );
    await act(() => result.current.log(slot, 'seconds', 30));
    expect(result.current.sets['plank|1|both']).toEqual({ id: 'set-1', value: 45 });
    expect(logSet.mock.calls[0]![0].id).toBe('set-1');
  });
});

import { describe, expect, it } from 'vitest';
import { STRENGTH_A, STRENGTH_B, week } from '../test-support/standard-prescriptions';
import { resolveSession } from './resolve';
import { buildSnapshot, parseSnapshot, PRESCRIPTION_SNAPSHOT_VERSION } from './snapshot';

const snapshotOf = (weekNumber: number) =>
  buildSnapshot({
    programmeId: 'programme-1',
    programmeVersion: 1,
    sessionTemplateId: 'template-strength-b',
    week: week(weekNumber),
    prescriptions: resolveSession(STRENGTH_B, week(weekNumber)),
  });

describe('prescription snapshot (BR-25)', () => {
  it('records the version, week and resolved prescriptions', () => {
    const snapshot = snapshotOf(5);
    expect(snapshot).toMatchObject({
      version: PRESCRIPTION_SNAPSHOT_VERSION,
      weekNumber: 5,
      volumeMultiplier: 0.65,
    });
    expect(snapshot.exercises.map((e) => e.sets)).toEqual([2, 2, 2, 2, 1]);
    expect(snapshot.exercises[1]).toMatchObject({ perSide: true, restS: 90 });
  });

  it('round-trips through JSON (jsonb) and Zod unchanged', () => {
    const snapshot = snapshotOf(1);
    expect(parseSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual({ ok: true, snapshot });
  });

  it('is a copy: later changes to the prescriptions do not reach it', () => {
    const prescriptions = resolveSession(STRENGTH_A, week(1));
    const snapshot = buildSnapshot({
      programmeId: 'programme-1',
      programmeVersion: 1,
      sessionTemplateId: 'template-strength-a',
      week: week(1),
      prescriptions,
    });
    prescriptions[0]!.sets = 9;
    const first = prescriptions[0]!.target;
    if (first.kind === 'reps') first.reps = 99;
    expect(snapshot.exercises[0]).toMatchObject({ sets: 3, target: { kind: 'reps', reps: 6 } });
  });

  it.each([
    ['an unknown version', { version: 2 }],
    ['an unknown field', { extra: true }],
    ['no exercises', { exercises: [] }],
    ['a multiplier above 1', { volumeMultiplier: 1.2 }],
  ])('rejects %s', (_, change) => {
    expect(parseSnapshot({ ...snapshotOf(1), ...change })).toEqual({ ok: false });
  });

  it.each([
    ['zero sets', { sets: 0 }],
    ['fractional reps', { target: { kind: 'reps', reps: 6.5 } }],
    ['two targets', { target: { kind: 'reps', reps: 6, seconds: 30 } }],
    ['an unknown target kind', { target: { kind: 'load', kg: 20 } }],
    ['negative rest', { restS: -1 }],
  ])('rejects an exercise with %s', (_, change) => {
    const snapshot = snapshotOf(1);
    const exercises = [{ ...snapshot.exercises[0], ...change }, ...snapshot.exercises.slice(1)];
    expect(parseSnapshot({ ...snapshot, exercises })).toEqual({ ok: false });
  });

  it.each([null, 'snapshot', 42, []])('rejects %j', (value) => {
    expect(parseSnapshot(value)).toEqual({ ok: false });
  });

  it('buildSnapshot refuses an empty session', () => {
    expect(() =>
      buildSnapshot({
        programmeId: 'programme-1',
        programmeVersion: 1,
        sessionTemplateId: 'template-rest',
        week: week(1),
        prescriptions: [],
      }),
    ).toThrow();
  });
});

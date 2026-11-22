import { describe, expect, it } from 'vitest';
import {
  LONG_RUN,
  STRENGTH_A,
  STRENGTH_B,
  STRENGTH_C,
  WEEKS,
  week,
} from '../test-support/standard-prescriptions';
import { resolvePrescription, resolveSession } from './resolve';
import type { PrescriptionOverride, TemplateExercise } from './types';

const setsOf = (exercises: readonly TemplateExercise[], n: number) =>
  resolveSession(exercises, week(n)).map((p) => p.sets);

describe('resolveSession', () => {
  it('BR-14: a full week uses the single §7 targets unchanged', () => {
    expect(resolveSession(STRENGTH_A, week(1))).toEqual(
      STRENGTH_A.map((e) => ({
        templateExerciseId: e.id,
        exerciseId: e.exerciseId,
        sequence: e.sequence,
        sets: e.sets,
        target: e.target,
        perSide: e.perSide,
        restS: e.restS,
        overridden: false,
      })),
    );
  });

  it.each([
    ['A', STRENGTH_A, [2, 2, 1, 1, 1]],
    ['B', STRENGTH_B, [2, 2, 2, 2, 1]],
    ['C', STRENGTH_C, [1, 1, 1, 1]],
  ] as const)('BR-17: week-5 sets of Strength %s match §7', (_, exercises, expected) => {
    expect(setsOf(exercises, 5)).toEqual(expected);
  });

  it('BR-17 / D25: week 5 keeps reps, durations, rest and per-side flags', () => {
    for (const exercises of [STRENGTH_A, STRENGTH_B, STRENGTH_C]) {
      const full = resolveSession(exercises, week(4));
      const deload = resolveSession(exercises, week(5));
      const withoutSets = (p: (typeof full)[number]) => ({ ...p, sets: 'ignored' });
      expect(deload.map(withoutSets)).toEqual(full.map(withoutSets));
    }
  });

  it('BR-18: without overrides, week n + 1 equals week n (outside the deload)', () => {
    for (const exercises of [STRENGTH_A, STRENGTH_B, STRENGTH_C, [LONG_RUN]]) {
      const byWeek = WEEKS.filter((w) => w.weekNumber !== 5).map((w) =>
        resolveSession(exercises, w),
      );
      for (const resolved of byWeek) expect(resolved).toEqual(byWeek[0]);
    }
  });

  it('returns exercises in programme order whatever the input order', () => {
    const shuffled = [...STRENGTH_C].reverse();
    expect(resolveSession(shuffled, week(1)).map((p) => p.sequence)).toEqual([1, 2, 3, 4]);
  });
});

describe('long run', () => {
  it('D25: the week ceiling is authoritative — 11,000 m, then 7,000 m in week 5', () => {
    expect(resolvePrescription(LONG_RUN, week(4)).target).toEqual({
      kind: 'distance',
      metres: 11_000,
    });
    expect(resolvePrescription(LONG_RUN, week(5))).toMatchObject({
      sets: 1,
      target: { kind: 'distance', metres: 7_000 },
    });
  });

  it('D25: a week with no ceiling keeps the template base', () => {
    const noCeiling = { ...week(1), longRunCeilingM: null };
    expect(resolvePrescription(LONG_RUN, noCeiling).target).toEqual(LONG_RUN.target);
  });

  it('D25: a week ceiling never changes a reps or duration target', () => {
    const plank = STRENGTH_A[4]!;
    expect(resolvePrescription(plank, week(5)).target).toEqual({ kind: 'duration', seconds: 45 });
  });
});

describe('overrides (BR-19 storage)', () => {
  const pullUp = STRENGTH_A[0]!;
  const plank = STRENGTH_A[4]!;
  const override = (fromWeek: number, reps: number): PrescriptionOverride => ({
    templateExerciseId: pullUp.id,
    fromWeek,
    target: { kind: 'reps', reps },
  });

  it('applies from its week onwards, never before', () => {
    const overrides = [override(3, 7)];
    expect(resolvePrescription(pullUp, week(2), overrides)).toMatchObject({
      target: { kind: 'reps', reps: 6 },
      overridden: false,
    });
    expect(resolvePrescription(pullUp, week(3), overrides)).toMatchObject({
      target: { kind: 'reps', reps: 7 },
      overridden: true,
    });
  });

  it('the latest accepted change in force wins', () => {
    const overrides = [override(6, 8), override(3, 7)];
    expect(resolvePrescription(pullUp, week(4), overrides).target).toEqual({
      kind: 'reps',
      reps: 7,
    });
    expect(resolvePrescription(pullUp, week(7), overrides).target).toEqual({
      kind: 'reps',
      reps: 8,
    });
  });

  it('BR-17: the deload still cuts sets but keeps the accepted reps', () => {
    expect(resolvePrescription(pullUp, week(5), [override(3, 7)])).toMatchObject({
      sets: 2,
      target: { kind: 'reps', reps: 7 },
    });
  });

  it('only touches its own exercise', () => {
    expect(resolvePrescription(plank, week(4), [override(1, 9)]).overridden).toBe(false);
  });

  it('applies to timed holds', () => {
    const longer: PrescriptionOverride = {
      templateExerciseId: plank.id,
      fromWeek: 2,
      target: { kind: 'duration', seconds: 50 },
    };
    expect(resolvePrescription(plank, week(2), [longer]).target).toEqual({
      kind: 'duration',
      seconds: 50,
    });
  });

  it('rejects an override whose target kind differs from the exercise', () => {
    const wrongKind: PrescriptionOverride = {
      templateExerciseId: pullUp.id,
      fromWeek: 1,
      target: { kind: 'duration', seconds: 30 },
    };
    expect(() => resolvePrescription(pullUp, week(1), [wrongKind])).toThrow(RangeError);
  });

  it('D71: an accepted long-run ceiling applies from its week, except in the deload, which keeps 7 km', () => {
    const longer: PrescriptionOverride = {
      templateExerciseId: LONG_RUN.id,
      fromWeek: 2,
      target: { kind: 'distance', metres: 12_000 },
    };
    const at = (n: number) => resolvePrescription(LONG_RUN, week(n), [longer]);
    expect(at(1)).toMatchObject({
      target: { kind: 'distance', metres: 11_000 },
      overridden: false,
    });
    expect(at(2)).toMatchObject({ target: { kind: 'distance', metres: 12_000 }, overridden: true });
    expect(at(5)).toMatchObject({ target: { kind: 'distance', metres: 7_000 }, overridden: false });
    expect(at(6)).toMatchObject({ target: { kind: 'distance', metres: 12_000 }, overridden: true });
  });

  it('BR-17 / D71: an accepted +1 rep carries through the deload, with its fewer sets', () => {
    const more: PrescriptionOverride = {
      templateExerciseId: pullUp.id,
      fromWeek: 2,
      target: { kind: 'reps', reps: 7 },
    };
    expect(resolvePrescription(pullUp, week(5), [more])).toMatchObject({
      sets: 2,
      target: { kind: 'reps', reps: 7 },
      overridden: true,
    });
  });
});

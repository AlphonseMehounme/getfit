import { describe, expect, it } from 'vitest';
import { resolveSession } from '../prescription/resolve';
import { buildSnapshot } from '../prescription/snapshot';
import { STRENGTH_A, STRENGTH_B, week } from '../test-support/standard-prescriptions';
import {
  exerciseSlots,
  finishOptions,
  firstOpenSlot,
  isPrescribedSlot,
  type LoggedSet,
  prescribedSlots,
  workoutProgress,
} from './progress';

const snapshot = (exercises: typeof STRENGTH_A, weekNumber = 1) =>
  buildSnapshot({
    programmeId: 'programme',
    programmeVersion: 1,
    sessionTemplateId: 'template',
    week: week(weekNumber),
    prescriptions: resolveSession(exercises, week(weekNumber)),
  });

const A = snapshot(STRENGTH_A);
const B = snapshot(STRENGTH_B);
const done = (slots: ReturnType<typeof prescribedSlots>): LoggedSet[] =>
  slots.map((slot) => ({ ...slot, completed: true }));

describe('prescribedSlots', () => {
  it('Strength A prescribes 12 sets, numbered from 1 per exercise', () => {
    const slots = prescribedSlots(A);
    expect(slots).toHaveLength(12);
    expect(slots.slice(0, 3)).toEqual([
      { exerciseId: 'pull-up', setNumber: 1, side: 'both' },
      { exerciseId: 'pull-up', setNumber: 2, side: 'both' },
      { exerciseId: 'pull-up', setNumber: 3, side: 'both' },
    ]);
  });

  it('BR-16: a per-side exercise has a left and a right slot for every set', () => {
    const slots = prescribedSlots(B);
    expect(slots).toHaveLength(20);
    expect(slots.filter((s) => s.exerciseId === 'bulgarian-split-squat')).toEqual([
      { exerciseId: 'bulgarian-split-squat', setNumber: 1, side: 'left' },
      { exerciseId: 'bulgarian-split-squat', setNumber: 1, side: 'right' },
      { exerciseId: 'bulgarian-split-squat', setNumber: 2, side: 'left' },
      { exerciseId: 'bulgarian-split-squat', setNumber: 2, side: 'right' },
      { exerciseId: 'bulgarian-split-squat', setNumber: 3, side: 'left' },
      { exerciseId: 'bulgarian-split-squat', setNumber: 3, side: 'right' },
    ]);
  });

  it('BR-17: a deload snapshot prescribes fewer sets (Strength A week 5: 2-2-1-1-1)', () => {
    expect(prescribedSlots(snapshot(STRENGTH_A, 5))).toHaveLength(7);
  });
});

describe('isPrescribedSlot', () => {
  it('accepts a prescribed slot and refuses a wrong side, number or exercise', () => {
    expect(isPrescribedSlot(A, { exerciseId: 'plank', setNumber: 2, side: 'both' })).toBe(true);
    expect(isPrescribedSlot(A, { exerciseId: 'plank', setNumber: 3, side: 'both' })).toBe(false);
    expect(isPrescribedSlot(A, { exerciseId: 'plank', setNumber: 1, side: 'left' })).toBe(false);
    expect(isPrescribedSlot(A, { exerciseId: 'chin-up', setNumber: 1, side: 'both' })).toBe(false);
    expect(
      isPrescribedSlot(B, { exerciseId: 'bulgarian-split-squat', setNumber: 1, side: 'both' }),
    ).toBe(false);
  });
});

describe('workoutProgress and finishOptions (D31)', () => {
  it('nothing logged: only partial can be saved', () => {
    const progress = workoutProgress(A, []);
    expect(progress).toEqual({ prescribed: 12, logged: 0, complete: false });
    expect(finishOptions(progress)).toEqual(['partial']);
  });

  it('D31: every set logged allows completed (and partial)', () => {
    const progress = workoutProgress(A, done(prescribedSlots(A)));
    expect(progress).toEqual({ prescribed: 12, logged: 12, complete: true });
    expect(finishOptions(progress)).toEqual(['completed', 'partial']);
  });

  it('D31: one set missing means partial only', () => {
    const progress = workoutProgress(A, done(prescribedSlots(A).slice(1)));
    expect(progress).toMatchObject({ logged: 11, complete: false });
    expect(finishOptions(progress)).toEqual(['partial']);
  });

  it('BR-14: a set counts whatever reps were achieved; not-done sets and extra sets do not count', () => {
    const sets: LoggedSet[] = [
      { exerciseId: 'pull-up', setNumber: 1, side: 'both', completed: true }, // 4 reps of 6: counts
      { exerciseId: 'pull-up', setNumber: 2, side: 'both', completed: false },
      { exerciseId: 'pull-up', setNumber: 4, side: 'both', completed: true }, // not prescribed
      { exerciseId: 'pull-up', setNumber: 1, side: 'both', completed: true }, // duplicate slot
    ];
    expect(workoutProgress(A, sets).logged).toBe(1);
  });

  it('BR-16: a per-side set needs both sides', () => {
    const left = prescribedSlots(B).filter((s) => s.side !== 'right');
    expect(workoutProgress(B, done(left))).toMatchObject({ logged: 14, complete: false });
  });

  it('a substitute fills the slot of the exercise it replaced', () => {
    const sets = done(prescribedSlots(A)).map((set) =>
      set.exerciseId === 'pull-up'
        ? { ...set, exerciseId: 'chin-up', substitutedForExerciseId: 'pull-up' }
        : set,
    );
    expect(workoutProgress(A, sets).complete).toBe(true);
  });
});

describe('firstOpenSlot (BR-6: resume at the right set)', () => {
  it('starts at the first set, and moves past the sets already done', () => {
    const slots = prescribedSlots(A);
    expect(firstOpenSlot(A, [])).toEqual(slots[0]);
    expect(firstOpenSlot(A, done(slots.slice(0, 2)))).toEqual(slots[2]);
  });

  it('a set marked not done is still open, and a gap is found before later sets', () => {
    const slots = prescribedSlots(A);
    const sets = [...done(slots.slice(1, 4)), { ...slots[0]!, completed: false }];
    expect(firstOpenSlot(A, sets)).toEqual(slots[0]);
  });

  it('BR-16: the right side is still open after the left', () => {
    const left = prescribedSlots(B).filter(
      (s) =>
        s.exerciseId === 'chin-up' ||
        (s.exerciseId === 'bulgarian-split-squat' && s.side === 'left' && s.setNumber === 1),
    );
    expect(firstOpenSlot(B, done(left))).toEqual({
      exerciseId: 'bulgarian-split-squat',
      setNumber: 1,
      side: 'right',
    });
  });

  it('null once every set is done, counting substitutes', () => {
    const sets = done(prescribedSlots(A)).map((set, i) =>
      i === 0 ? { ...set, exerciseId: 'chin-up', substitutedForExerciseId: 'pull-up' } : set,
    );
    expect(firstOpenSlot(A, sets)).toBeNull();
  });
});

describe('exerciseSlots', () => {
  it('BR-16: lists one exercise’s sets, both sides for a per-side exercise', () => {
    expect(exerciseSlots({ exerciseId: 'side-plank', sets: 2, perSide: true })).toEqual([
      { exerciseId: 'side-plank', setNumber: 1, side: 'left' },
      { exerciseId: 'side-plank', setNumber: 1, side: 'right' },
      { exerciseId: 'side-plank', setNumber: 2, side: 'left' },
      { exerciseId: 'side-plank', setNumber: 2, side: 'right' },
    ]);
  });
});

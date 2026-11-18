import { describe, expect, it } from 'vitest';
import {
  availableEquipment,
  substituteCandidates,
  type ExerciseRef,
  type ExerciseRelation,
} from './substitutes';

// The PRD §8 library entries these tests need (category, equipment, substitutes as in content/).
const EXERCISES: ExerciseRef[] = [
  { id: 'plank', category: 'core', equipment: ['bodyweight'] },
  { id: 'abdominal-crunch', category: 'core', equipment: ['bodyweight'] },
  { id: 'hanging-knee-raise', category: 'core', equipment: ['pull_up_bar'] },
  { id: 'bodyweight-squat', category: 'lower', equipment: ['bodyweight'] },
  { id: 'push-up', category: 'upper', equipment: ['bodyweight'] },
];

const sub = (exerciseId: string, relatedExerciseId: string): ExerciseRelation => ({
  exerciseId,
  relatedExerciseId,
  kind: 'substitute',
});

const RELATIONS: ExerciseRelation[] = [
  sub('plank', 'abdominal-crunch'),
  sub('hanging-knee-raise', 'abdominal-crunch'),
  sub('hanging-knee-raise', 'plank'),
  sub('abdominal-crunch', 'plank'),
];

const byId = (id: string) => EXERCISES.find((e) => e.id === id)!;
const ids = (refs: ExerciseRef[]) => refs.map((r) => r.id);
const PROGRAMME = ['pull_up_bar', 'bodyweight'] as const;

describe('availableEquipment', () => {
  it("D40: the user's recorded equipment, plus bodyweight (D42)", () => {
    expect([...availableEquipment(['dumbbells'], PROGRAMME)].sort()).toEqual([
      'bodyweight',
      'dumbbells',
    ]);
  });

  it("D40: falls back to the programme's required equipment when none is recorded", () => {
    expect([...availableEquipment([], PROGRAMME)].sort()).toEqual(['bodyweight', 'pull_up_bar']);
  });

  it('D42: no item implies another (gym does not imply a pull-up bar)', () => {
    expect(availableEquipment(['gym'], PROGRAMME).has('pull_up_bar')).toBe(false);
  });
});

describe('substituteCandidates', () => {
  const candidates = (id: string, available = availableEquipment([], PROGRAMME)) =>
    ids(substituteCandidates(byId(id), RELATIONS, EXERCISES, available));

  it('D40: plank → abdominal crunch', () => {
    expect(candidates('plank')).toEqual(['abdominal-crunch']);
  });

  it('D40: hanging knee raise → crunch, plank, in relation order', () => {
    expect(candidates('hanging-knee-raise')).toEqual(['abdominal-crunch', 'plank']);
  });

  it('D42: bodyweight substitutes stay available when the user ticked only a pull-up bar', () => {
    expect(
      candidates('hanging-knee-raise', availableEquipment(['pull_up_bar'], PROGRAMME)),
    ).toEqual(['abdominal-crunch', 'plank']);
  });

  it('D40: hides a substitute whose equipment is not available', () => {
    const relations = [...RELATIONS, sub('abdominal-crunch', 'hanging-knee-raise')];
    const run = (available: ReturnType<typeof availableEquipment>) =>
      ids(substituteCandidates(byId('abdominal-crunch'), relations, EXERCISES, available));
    expect(run(availableEquipment(['bands'], PROGRAMME))).toEqual(['plank']);
    expect(run(availableEquipment([], PROGRAMME))).toEqual(['plank', 'hanging-knee-raise']);
  });

  it('D40: only the same category', () => {
    const relations = [sub('plank', 'bodyweight-squat'), sub('plank', 'abdominal-crunch')];
    expect(
      ids(substituteCandidates(byId('plank'), relations, EXERCISES, availableEquipment([], []))),
    ).toEqual(['abdominal-crunch']);
  });

  it('D40: never the exercise itself, never variations, and unknown ids are ignored', () => {
    const relations: ExerciseRelation[] = [
      sub('plank', 'plank'),
      sub('plank', 'not-in-library'),
      { exerciseId: 'plank', relatedExerciseId: 'abdominal-crunch', kind: 'variation' },
    ];
    expect(
      substituteCandidates(byId('plank'), relations, EXERCISES, availableEquipment([], [])),
    ).toEqual([]);
  });

  it('an exercise with no substitutes has no candidates', () => {
    expect(candidates('push-up')).toEqual([]);
  });
});

import { describe, expect, it } from 'vitest';
import { standardProgramme } from '../test-support/standard-programme';
import { availabilityMismatches, programmeAvailability } from './availability';
import { missingEquipment } from './equipment-check';
import { heightToCm, weightToKg } from './measurements';
import { skippedSteps } from './steps';

describe('missingEquipment (PRD §6.2 AC, D42)', () => {
  const required = ['pull_up_bar', 'bodyweight'] as const;

  it('warns when the pull-up bar is missing', () => {
    expect(missingEquipment(['dumbbells'], required)).toEqual(['pull_up_bar']);
  });

  it('D42: a gym is not a pull-up bar; bodyweight is never missing', () => {
    expect(missingEquipment(['gym'], required)).toEqual(['pull_up_bar']);
  });

  it('nothing is missing with a pull-up bar', () => {
    expect(missingEquipment(['pull_up_bar'], required)).toEqual([]);
  });

  it('no equipment recorded is unknown, not lacking: no warning', () => {
    expect(missingEquipment([], required)).toEqual([]);
  });
});

describe('availability (D36)', () => {
  const programme = programmeAvailability(standardProgramme());

  it('D36: the pre-fill is the standard week', () => {
    expect(programme).toEqual({
      1: 'training',
      2: 'rest',
      3: 'training',
      4: 'rest',
      5: 'training',
      6: 'rest',
      7: 'running',
    });
  });

  it('D36: the pre-fill itself matches', () => {
    expect(availabilityMismatches(programme, programme)).toEqual([]);
  });

  it('D36: changed days are mismatches, Monday first; unanswered days are not', () => {
    expect(availabilityMismatches({ 7: 'rest', 6: 'running', 1: 'training' }, programme)).toEqual([
      6, 7,
    ]);
    expect(availabilityMismatches({}, programme)).toEqual([]);
  });
});

describe('skippedSteps (PRD §6.2)', () => {
  const none = { goals: 0, experience: false, equipment: 0, availability: 0, baselines: 0 };

  it('counts every optional step when only step 1 was saved', () => {
    expect(skippedSteps(none)).toBe(5);
  });

  it('counts nothing when every step has an answer', () => {
    expect(
      skippedSteps({ goals: 2, experience: true, equipment: 1, availability: 7, baselines: 1 }),
    ).toBe(0);
  });

  it('counts only the steps left empty', () => {
    expect(skippedSteps({ ...none, goals: 1, baselines: 3 })).toBe(3);
  });
});

describe('onboarding measurements (AGENTS §6)', () => {
  it('stores height in cm to one decimal', () => {
    expect(heightToCm(165, 'cm')).toBe(165);
    expect(heightToCm(65, 'in')).toBe(165.1);
  });

  it('stores weight in kg to two decimals', () => {
    expect(weightToKg(55, 'kg')).toBe(55);
    expect(weightToKg(121, 'lb')).toBe(54.88);
  });

  it.each([Number.NaN, Infinity])('rejects %d', (value) => {
    expect(() => heightToCm(value, 'cm')).toThrow(RangeError);
    expect(() => weightToKg(value, 'kg')).toThrow(RangeError);
  });
});

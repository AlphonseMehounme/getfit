import { describe, expect, it } from 'vitest';
import { programmeSchema } from './programme.ts';
import { makeProgramme } from './programme-fixture.ts';

const errors = (input: unknown) => {
  const result = programmeSchema.safeParse(input);
  return result.success ? [] : result.error.issues.map((i) => i.path.join('.'));
};

describe('programmeSchema', () => {
  it('accepts a complete programme', () => {
    expect(errors(makeProgramme())).toEqual([]);
  });

  it('BR-14 / D1: a prescription has exactly one target', () => {
    const p = makeProgramme();
    const exercise = p.templates[0]!.exercises[0]!;
    const twoTargets = { ...exercise, target: { reps: 6, durationS: 30 } };
    p.templates[0]!.exercises = [twoTargets as never];
    expect(errors(p)).toEqual(['templates.0.exercises.0.target']);
  });

  it('BR-8: recovery and rest templates never count for adherence', () => {
    const p = makeProgramme();
    p.templates[1] = { ...p.templates[1]!, countsForAdherence: true };
    expect(errors(p)).toEqual(['templates.1.countsForAdherence']);
  });

  it('BR-18: a week multiplier is in (0, 1]', () => {
    const p = makeProgramme();
    p.weeks[0] = { ...p.weeks[0]!, volumeMultiplier: 1.1 };
    expect(errors(p)).toEqual(['weeks.0.volumeMultiplier']);
  });

  it('D15: the programme, weeks and templates need FR and EN', () => {
    const p: Record<string, unknown> = { ...makeProgramme() };
    delete p.en;
    expect(errors(p)).toEqual(['en']);
    const week = makeProgramme();
    week.weeks[0] = { ...week.weeks[0]!, fr: { label: ' ', focus: 'x' } };
    expect(errors(week)).toEqual(['weeks.0.fr.label']);
  });

  it('D5: the week pattern names all seven weekdays', () => {
    const p = makeProgramme();
    const sixDays = Object.fromEntries(
      Object.entries(p.weekPattern).filter(([day]) => day !== '7'),
    );
    expect(errors({ ...p, weekPattern: sixDays })).toEqual(['weekPattern.7']);
  });

  it('rejects unknown goals and equipment', () => {
    expect(errors(makeProgramme({ objectives: ['lose_weight' as never] }))).toEqual([
      'objectives.0',
    ]);
    expect(errors(makeProgramme({ requiredEquipment: ['bench' as never] }))).toEqual([
      'requiredEquipment.0',
    ]);
  });
});

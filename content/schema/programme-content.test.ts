import { fileURLToPath } from 'node:url';
import {
  longRunCeilingFor,
  resolvePrescription,
  targetFromColumns,
  type ProgrammeWeek,
  type TemplateExercise,
} from '@getfit/domain';
import { describe, expect, it } from 'vitest';
import { checkLibrary } from './library-check.ts';
import { readExerciseFiles, readProgrammeFiles } from './load.ts';
import { checkProgrammes } from './programme-check.ts';
import type { SessionTemplate } from './programme.ts';

// The real launch programme in content/programmes, checked as the seed generator checks it,
// then run through the domain's own prescription rules (AGENTS §5.3: one implementation).
const contentDir = fileURLToPath(new URL('..', import.meta.url));
const library = checkLibrary(readExerciseFiles(contentDir));
const [programme] = checkProgrammes(readProgrammeFiles(contentDir), library);
if (!programme) throw new Error('content/programmes holds no programme');

const template = (slug: string): SessionTemplate => {
  const found = programme.templates.find((t) => t.slug === slug);
  if (!found) throw new Error(`no template ${slug}`);
  return found;
};

/** The same mapping the repositories make from `template_exercises` rows. */
const toDomain = (t: SessionTemplate): TemplateExercise[] =>
  t.exercises.map((e, index) => ({
    id: `${t.slug}-${index + 1}`,
    exerciseId: e.exercise,
    sequence: index + 1,
    sets: e.sets,
    target: targetFromColumns({
      targetReps: 'reps' in e.target ? e.target.reps : null,
      targetDurationS: 'durationS' in e.target ? e.target.durationS : null,
      targetDistanceM: 'distanceM' in e.target ? e.target.distanceM : null,
    }),
    perSide: e.perSide,
    restS: e.restS,
  }));

const weeks: ProgrammeWeek[] = programme.weeks.map((w) => ({
  weekNumber: w.weekNumber,
  volumeMultiplier: w.volumeMultiplier,
  longRunCeilingM: w.longRunCeilingM,
}));

/** "slug sets×target rest", e.g. "pull-up 3×6 120" or "side-plank 2×30s/side 45". */
const row = (e: SessionTemplate['exercises'][number]) => {
  const target =
    'reps' in e.target
      ? `${e.target.reps}`
      : 'durationS' in e.target
        ? `${e.target.durationS}s`
        : `${e.target.distanceM}m`;
  return `${e.exercise} ${e.sets}×${target}${e.perSide ? '/side' : ''} ${e.restS ?? '-'}`;
};

describe('force-muscle-endurance-8w', () => {
  it('PRD §7: an 8-week programme for a pull-up bar and bodyweight', () => {
    expect(programme).toMatchObject({ version: 1, durationWeeks: 8 });
    expect(programme.requiredEquipment).toEqual(['pull_up_bar', 'bodyweight']);
    expect(programme.weeks).toHaveLength(8);
  });

  it.each([
    [
      'strength-a',
      40,
      [
        'pull-up 3×6 120',
        'push-up 3×12 90',
        'pike-push-up 2×8 90',
        'glute-bridge 2×15 60',
        'plank 2×45s 60',
      ],
    ],
    [
      'strength-b',
      45,
      [
        'chin-up 3×6 120',
        'bulgarian-split-squat 3×10/side 90',
        'single-leg-glute-bridge 3×10/side 60',
        'standing-calf-raise 3×20 60',
        'hanging-knee-raise 2×12 60',
      ],
    ],
    [
      'strength-c',
      30,
      ['pull-up 2×6 120', 'push-up 2×12 90', 'pike-push-up 2×8 90', 'side-plank 2×30s/side 45'],
    ],
  ])('PRD §7 / D1 / D12: %s matches the programme table', (slug, minutes, rows) => {
    expect(template(slug).estimatedDurationMin).toBe(minutes);
    expect(template(slug).exercises.map(row)).toEqual(rows);
  });

  it('D24: recovery is a 30 min walk then 3 × 3 min of mobility; Thursday offers the mobility', () => {
    expect(template('recovery').exercises.map(row)).toEqual([
      'easy-walk 1×1800s -',
      'mobility-hips 1×180s -',
      'mobility-ankles 1×180s -',
      'mobility-shoulders 1×180s -',
    ]);
    expect(template('rest-mobility').exercises.map(row)).toEqual(
      template('recovery').exercises.slice(1).map(row),
    );
    expect(template('rest-pre-run').exercises).toEqual([]);
  });

  it('D25: the long-run template keeps its 11,000 m base', () => {
    expect(template('long-run').exercises.map(row)).toEqual(['long-run 1×11000m -']);
  });

  it('D24 / D5: the standard week runs Monday A to Sunday long run', () => {
    expect(Object.values(programme.weekPattern)).toEqual([
      'strength-a',
      'recovery',
      'strength-b',
      'rest-mobility',
      'strength-c',
      'rest-pre-run',
      'long-run',
    ]);
  });

  it('BR-8: only A, B, C and the long run count for adherence', () => {
    const counting = programme.templates.filter((t) => t.countsForAdherence).map((t) => t.slug);
    expect(counting).toEqual(['strength-a', 'strength-b', 'strength-c', 'long-run']);
  });

  it('BR-10: Strength B is lower body; A and C are upper body', () => {
    expect(template('strength-b').bodyFocus).toBe('lower');
    expect(template('strength-a').bodyFocus).toBe('upper');
    expect(template('strength-c').bodyFocus).toBe('upper');
  });

  it.each([
    ['strength-a', [2, 2, 1, 1, 1]],
    ['strength-b', [2, 2, 2, 2, 1]],
    ['strength-c', [1, 1, 1, 1]],
  ])('BR-17: week 5 sets for %s follow PRD §7 (%j)', (slug, sets) => {
    const week5 = weeks[4]!;
    const resolved = toDomain(template(slug)).map((e) => resolvePrescription(e, week5));
    expect(resolved.map((p) => p.sets)).toEqual(sets);
    // Reps, durations, rest and per-side flags are unchanged in the deload week (D25).
    const week1 = toDomain(template(slug)).map((e) => resolvePrescription(e, weeks[0]!));
    const unchanged = (p: ReturnType<typeof resolvePrescription>) => [p.target, p.restS, p.perSide];
    expect(resolved.map(unchanged)).toEqual(week1.map(unchanged));
  });

  it('D25: every week ceiling = base × multiplier, rounded down to a whole km', () => {
    const base = toDomain(template('long-run'))[0]!;
    for (const week of weeks) {
      expect(week.longRunCeilingM).toBe(longRunCeilingFor(11_000, week.volumeMultiplier));
      expect(resolvePrescription(base, week).target).toEqual({
        kind: 'distance',
        metres: week.longRunCeilingM,
      });
    }
    expect(weeks[4]).toEqual({ weekNumber: 5, volumeMultiplier: 0.65, longRunCeilingM: 7000 });
  });

  it('PRD §4: weeks carry the prototype labels', () => {
    expect(programme.weeks.map((w) => w.fr.label)).toEqual([
      'Transition',
      'Installation',
      'Installation',
      'Consolidation',
      'Allégée',
      'Progression',
      'Progression',
      'Évaluation',
    ]);
    expect(programme.weeks.map((w) => w.focusKey)).toEqual([
      'transition',
      'installation',
      'installation',
      'consolidation',
      'deload',
      'progression',
      'progression',
      'evaluation',
    ]);
  });
});

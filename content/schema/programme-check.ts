import type { Exercise } from './exercise.ts';
import { ContentError, type ContentFile } from './library-check.ts';
import { programmeSchema, WEEKDAYS, type Programme } from './programme.ts';

// Cross-file rules for a programme: it must fit the exercise library and be internally consistent.

const isSequence = (values: readonly number[]) => values.every((value, i) => value === i + 1);

/** Validates programme files against the checked library; throws a `ContentError` naming the file. */
export function checkProgrammes(
  files: readonly ContentFile[],
  library: readonly Exercise[],
): Programme[] {
  const bySlug = new Map(library.map((e) => [e.slug, e]));

  return files.map(({ stem, data }) => {
    const fail = (message: string): never => {
      throw new ContentError(`${stem}.json: ${message}`);
    };
    const parsed = programmeSchema.safeParse(data);
    if (!parsed.success) {
      fail(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    }
    const programme = parsed.data as Programme;
    if (programme.slug !== stem) fail(`slug "${programme.slug}" must match the file name`);

    const templateSlugs = programme.templates.map((t) => t.slug);
    if (new Set(templateSlugs).size !== templateSlugs.length) fail('template slugs must be unique');

    for (const template of programme.templates) {
      template.exercises.forEach((entry, index) => {
        const where = `template "${template.slug}" #${index + 1}`;
        const exercise = bySlug.get(entry.exercise);
        if (!exercise) return fail(`${where}: exercise "${entry.exercise}" does not exist`);
        // BR-16: per-side targets belong to unilateral exercises, and unilateral exercises are per side.
        if (entry.perSide !== exercise.isUnilateral) {
          fail(`${where}: perSide must be ${exercise.isUnilateral} for "${exercise.slug}" (BR-16)`);
        }
        // BR-15: a distance is the long-run ceiling, only for running exercises.
        if ('distanceM' in entry.target && exercise.category !== 'running') {
          fail(`${where}: a distance target needs a running exercise (BR-15)`);
        }
      });
    }

    const used = new Set(WEEKDAYS.map((day) => programme.weekPattern[day]!));
    for (const slug of used) {
      if (!templateSlugs.includes(slug)) fail(`weekPattern names unknown template "${slug}"`);
    }
    for (const slug of templateSlugs) {
      if (!used.has(slug)) fail(`template "${slug}" is never scheduled`);
    }

    const weekNumbers = programme.weeks.map((w) => w.weekNumber);
    if (weekNumbers.length !== programme.durationWeeks || !isSequence(weekNumbers)) {
      fail(`weeks must be numbered 1 to ${programme.durationWeeks}, in order`);
    }
    return programme;
  });
}

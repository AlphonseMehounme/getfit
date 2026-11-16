import { bySlug, exerciseSchema, searchTermsOf, type Exercise } from './exercise.ts';
import { LAUNCH_LIBRARY } from './library.ts';

// Cross-file rules a single file can't check: file names, the §8 list, relations and search terms.

export interface ContentFile {
  /** File name stem, e.g. "pull-up" for content/exercises/pull-up.json. */
  stem: string;
  data: unknown;
}

export class ContentError extends Error {
  override name = 'ContentError';
}

/** Validates every exercise file and the rules across them; throws a `ContentError` naming the file. */
export function checkLibrary(files: readonly ContentFile[]): Exercise[] {
  const exercises = files.map(({ stem, data }) => {
    const parsed = exerciseSchema.safeParse(data);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
      throw new ContentError(`${stem}.json: ${issues.join('; ')}`);
    }
    const exercise = parsed.data;
    if (exercise.slug !== stem) {
      throw new ContentError(`${stem}.json: slug "${exercise.slug}" must match the file name`);
    }
    const expected = (LAUNCH_LIBRARY as Record<string, string>)[exercise.slug];
    if (expected === undefined) {
      throw new ContentError(`${stem}.json: "${exercise.slug}" is not in the PRD §8 library`);
    }
    if (expected !== exercise.category) {
      throw new ContentError(`${stem}.json: category must be "${expected}" (PRD §8)`);
    }
    return exercise;
  });

  const slugs = new Set(exercises.map((e) => e.slug));
  const termOwner = new Map<string, string>();
  for (const exercise of exercises) {
    for (const related of [...exercise.relations.variations, ...exercise.relations.substitutes]) {
      if (related === exercise.slug) {
        throw new ContentError(`${exercise.slug}.json: an exercise cannot relate to itself`);
      }
      if (!slugs.has(related)) {
        throw new ContentError(
          `${exercise.slug}.json: related exercise "${related}" does not exist`,
        );
      }
    }
    for (const term of searchTermsOf(exercise)) {
      const owner = termOwner.get(term);
      if (owner !== undefined && owner !== exercise.slug) {
        throw new ContentError(
          `${exercise.slug}.json: search term "${term}" is also used by ${owner}`,
        );
      }
      termOwner.set(term, exercise.slug);
    }
  }

  return [...exercises].sort(bySlug);
}

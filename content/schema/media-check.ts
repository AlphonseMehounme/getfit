import { normaliseTerm, type Exercise } from './exercise.ts';
import { DEV_ONLY_LICENCE, FINAL_SIZE, hasFile, mediaManifestSchema } from './media.ts';

// PRD §8 media QA, rules 1–5 and 7 (rule 6, the per-page Playwright check, ships with the library page; D27).
// Pure: the CLI probes the files and passes what it found.

/** What probing a file found: its real size and format, or that it could not be decoded. */
export type ProbedFile = { width: number; height: number; format: string } | { error: string };

export interface MediaCheckInput {
  manifest: unknown;
  exercises: readonly Exercise[];
  /** Every file in `public/media/exercises/`, by file name. */
  files: ReadonlyMap<string, ProbedFile>;
  /** D18 / rule 7: true for a production build. */
  production: boolean;
}

export function checkMedia({ manifest, exercises, files, production }: MediaCheckInput): string[] {
  const parsed = mediaManifestSchema.safeParse(manifest);
  if (!parsed.success) {
    return parsed.error.issues.map((i) => `manifest ${i.path.join('.')}: ${i.message}`);
  }
  const { exercises: entries, rejected } = parsed.data;
  const errors: string[] = [];
  const bySlug = new Map(exercises.map((e) => [e.slug, e]));
  const rejectedFiles = new Set(rejected.map((r) => r.file));
  const fileOwners = new Map<string, string>();

  // Rule 1: every exercise slug has exactly one entry (an intentional fallback counts), and nothing else does.
  for (const slug of bySlug.keys()) {
    if (!(slug in entries)) errors.push(`${slug}: no manifest entry (rule 1)`);
  }

  for (const [slug, entry] of Object.entries(entries)) {
    const exercise = bySlug.get(slug);
    if (!exercise) errors.push(`${slug}: not an exercise in content/exercises (rule 1)`);
    if (!hasFile(entry)) continue;
    const fail = (message: string) => errors.push(`${slug}: ${message}`);

    // Rule 4: the manifest key equals the file name stem.
    if (entry.file.replace(/\.[a-z]+$/, '') !== slug)
      fail(`file "${entry.file}" must be named ${slug} (rule 4)`);

    // Rule 3: no file is referenced by two slugs, and rejected files never are.
    const owner = fileOwners.get(entry.file);
    if (owner) fail(`file "${entry.file}" is already used by ${owner} (rule 3)`);
    fileOwners.set(entry.file, slug);
    if (rejectedFiles.has(entry.file)) fail(`file "${entry.file}" is rejected (rule 3, D19)`);

    // Rule 2: the file exists, decodes and matches what the manifest declares.
    const probed = files.get(entry.file);
    if (!probed) {
      fail(`file "${entry.file}" is missing (rule 2)`);
    } else if ('error' in probed) {
      fail(`file "${entry.file}" does not decode: ${probed.error} (rule 2)`);
    } else if (
      probed.width !== entry.width ||
      probed.height !== entry.height ||
      probed.format !== entry.format
    ) {
      fail(
        `file "${entry.file}" is ${probed.width}×${probed.height} ${probed.format}, ` +
          `the manifest says ${entry.width}×${entry.height} ${entry.format} (rule 2)`,
      );
    }

    // D27: the commissioned set is 1,200 × 900 WebP; placeholders keep their native size.
    if (
      entry.status === 'final' &&
      (entry.width !== FINAL_SIZE.width ||
        entry.height !== FINAL_SIZE.height ||
        entry.format !== FINAL_SIZE.format)
    ) {
      fail('a final asset must be a 1,200 × 900 WebP (D27)');
    }

    // Rule 5: alt text in both languages, naming the exercise, and a licence.
    if (exercise) {
      for (const locale of ['fr', 'en'] as const) {
        if (!normaliseTerm(entry.alt[locale]).includes(normaliseTerm(exercise[locale].name))) {
          fail(`alt.${locale} must name "${exercise[locale].name}" (rule 5)`);
        }
      }
    }
    if (entry.licence === DEV_ONLY_LICENCE && entry.status !== 'placeholder') {
      fail(`licence "${DEV_ONLY_LICENCE}" is allowed only on a placeholder (D27)`);
    }

    // Rule 7 / D18: placeholders never reach a production build.
    if (production && entry.status === 'placeholder') {
      fail('placeholder media is blocked in production builds (rule 7, D18)');
    }
  }

  // No stray file: an image that isn't in the manifest could only be found by guessing its name.
  for (const name of files.keys()) {
    if (!fileOwners.has(name)) errors.push(`${name}: file is not in the manifest (AGENTS §8)`);
  }

  return errors;
}

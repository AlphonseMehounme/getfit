import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { checkLibrary } from '../content/schema/library-check.ts';
import { readExerciseFiles } from '../content/schema/load.ts';
import { checkMedia, type ProbedFile } from '../content/schema/media-check.ts';

// `pnpm media:check` and the web app's `prebuild` (PRD §8 media QA, rules 1–5 and 7).
// A Vercel production build fails while any placeholder remains (D18).
const root = fileURLToPath(new URL('..', import.meta.url));
const mediaDir = join(root, 'apps/web/public/media/exercises');

async function probe(file: string): Promise<ProbedFile> {
  try {
    const { width, height, format } = await sharp(join(mediaDir, file)).metadata();
    return { width, height, format };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

const names = readdirSync(mediaDir).filter((name) => !name.startsWith('.'));
const files = new Map(await Promise.all(names.map(async (n) => [n, await probe(n)] as const)));
const production = process.env.VERCEL_ENV === 'production';

const errors = checkMedia({
  manifest: JSON.parse(readFileSync(join(root, 'content/media/manifest.json'), 'utf8')) as unknown,
  exercises: checkLibrary(readExerciseFiles(join(root, 'content'))),
  files,
  production,
});

if (errors.length > 0) {
  console.error(`media:check failed${production ? ' (production build)' : ''}:`);
  for (const error of errors) console.error(`  - ${error}`);
  process.exit(1);
}
console.log(`media:check passed: ${files.size} files${production ? ' (production build)' : ''}`);

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContentFile } from './library-check.ts';

function readJsonFiles(dir: string): ContentFile[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => ({
      stem: name.slice(0, -'.json'.length),
      data: JSON.parse(readFileSync(join(dir, name), 'utf8')) as unknown,
    }));
}

/** Reads every `content/exercises/*.json` file. I/O only; `checkLibrary` validates. */
export const readExerciseFiles = (contentDir: string) =>
  readJsonFiles(join(contentDir, 'exercises'));

/** Reads every `content/programmes/*.json` file. I/O only; `checkProgrammes` validates. */
export const readProgrammeFiles = (contentDir: string) =>
  readJsonFiles(join(contentDir, 'programmes'));

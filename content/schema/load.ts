import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ContentFile } from './library-check.ts';

/** Reads every `content/exercises/*.json` file. I/O only; `checkLibrary` validates. */
export function readExerciseFiles(contentDir: string): ContentFile[] {
  const dir = join(contentDir, 'exercises');
  return readdirSync(dir)
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => ({
      stem: name.slice(0, -'.json'.length),
      data: JSON.parse(readFileSync(join(dir, name), 'utf8')) as unknown,
    }));
}

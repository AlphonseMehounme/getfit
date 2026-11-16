import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkLibrary } from '../../content/schema/library-check.ts';
import { readExerciseFiles, readProgrammeFiles } from '../../content/schema/load.ts';
import { checkProgrammes } from '../../content/schema/programme-check.ts';
import { buildSeed } from './build-seed.ts';

// `pnpm seed:generate`: content/ → supabase/seed.sql (ADR 0005). CI fails if the committed file is stale.
const contentDir = fileURLToPath(new URL('../../content/', import.meta.url));
const seedFile = fileURLToPath(new URL('../seed.sql', import.meta.url));

const exercises = checkLibrary(readExerciseFiles(contentDir));
const programmes = checkProgrammes(readProgrammeFiles(contentDir), exercises);
writeFileSync(seedFile, buildSeed(exercises, programmes));
console.log(`supabase/seed.sql: ${exercises.length} exercises, ${programmes.length} programme(s)`);

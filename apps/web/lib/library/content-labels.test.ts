import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import en from '../../messages/en.json';
import fr from '../../messages/fr.json';

// PRD §6.7: every muscle group and category in the seeded content has a label in both languages, so the library
// never shows a raw key (AGENTS §9).
const dir = fileURLToPath(new URL('../../../../content/exercises/', import.meta.url));
const exercises = readdirSync(dir).map(
  (f) =>
    JSON.parse(readFileSync(`${dir}${f}`, 'utf8')) as {
      muscleGroups: string[];
      category: string;
      difficulty: string;
    },
);

describe('library labels for the content', () => {
  it('every muscle group, category and difficulty has an FR and EN label', () => {
    for (const messages of [en, fr]) {
      const { muscles, categories, difficulties } = messages.Library;
      for (const e of exercises) {
        for (const m of e.muscleGroups) expect(muscles, m).toHaveProperty(m);
        expect(categories, e.category).toHaveProperty(e.category);
        expect(difficulties, e.difficulty).toHaveProperty(e.difficulty);
      }
    }
    expect(exercises).toHaveLength(19);
  });
});

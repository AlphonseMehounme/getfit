import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkLibrary } from './library-check.ts';
import { readExerciseFiles } from './load.ts';
import { checkMedia } from './media-check.ts';
import { mediaManifestSchema } from './media.ts';

// The real manifest. File probing is covered by `pnpm media:check`; here the files are declared as probed.
const contentDir = fileURLToPath(new URL('..', import.meta.url));
const raw: unknown = JSON.parse(readFileSync(`${contentDir}/media/manifest.json`, 'utf8'));
const manifest = mediaManifestSchema.parse(raw);
const exercises = checkLibrary(readExerciseFiles(contentDir));
const entries = Object.entries(manifest.exercises);
const files = new Map(
  entries.flatMap(([, e]) =>
    e.status === 'fallback'
      ? []
      : [[e.file, { width: e.width, height: e.height, format: e.format }] as const],
  ),
);

const slugsWith = (status: string) =>
  entries.filter(([, e]) => e.status === status).map(([slug]) => slug);
const source = (slug: string) => {
  const entry = manifest.exercises[slug];
  return entry && entry.status !== 'fallback' ? entry.source : undefined;
};

describe('content/media/manifest.json', () => {
  it('passes media QA in development', () => {
    expect(checkMedia({ manifest: raw, exercises, files, production: false })).toEqual([]);
  });

  it('rule 7 / D18: blocks a production build while placeholders remain', () => {
    const errors = checkMedia({ manifest: raw, exercises, files, production: true });
    expect(errors).toHaveLength(10);
    expect(errors.every((e) => e.endsWith('(rule 7, D18)'))).toBe(true);
  });

  it('PRD §4: 10 placeholders and 9 intentional fallbacks', () => {
    expect(slugsWith('placeholder')).toHaveLength(10);
    expect(slugsWith('fallback')).toEqual([
      'abdominal-crunch',
      'bodyweight-squat',
      'chin-up',
      'easy-walk',
      'mobility-ankles',
      'mobility-hips',
      'mobility-shoulders',
      'reverse-lunge',
      'standing-calf-raise',
    ]);
  });

  it('D18: traction.jpg is only pull-up and course.jpg is only long-run', () => {
    const sources = entries.map(([slug]) => [slug, source(slug)] as const);
    expect(sources.filter(([, s]) => s?.endsWith('/traction.jpg')).map(([slug]) => slug)).toEqual([
      'pull-up',
    ]);
    expect(sources.filter(([, s]) => s?.endsWith('/course.jpg')).map(([slug]) => slug)).toEqual([
      'long-run',
    ]);
  });

  it('D19: mollets.jpg and pont-fessier-reference.jpg are rejected, and glute-bridge uses pont-fessier.jpg', () => {
    expect(manifest.rejected.map((r) => r.file)).toEqual([
      'mollets.jpg',
      'pont-fessier-reference.jpg',
    ]);
    expect(source('glute-bridge')).toBe('prototype ressources_images/pont-fessier.jpg');
    const sources = entries.map(([slug]) => source(slug));
    expect(sources.some((s) => s?.includes('mollets') || s?.includes('reference'))).toBe(false);
  });

  it('PRD §8: every image was verified by a human', () => {
    for (const [, entry] of entries) {
      if (entry.status !== 'fallback')
        expect(entry.verified_by).toBe('AL (PRD v2 §4 audit, 2026-11-16)');
    }
  });
});

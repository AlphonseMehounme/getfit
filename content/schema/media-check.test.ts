import { describe, expect, it } from 'vitest';
import { checkMedia, type ProbedFile } from './media-check.ts';
import type { MediaManifest } from './media.ts';
import { makeExercise } from './test-fixture.ts';

const pullUp = makeExercise();
const plank = makeExercise({ slug: 'plank', category: 'core', pattern: null });
plank.fr = { ...plank.fr, name: 'Planche', mediaAlt: 'Planche.' };
plank.en = { ...plank.en, name: 'Plank', mediaAlt: 'Plank.' };

const asset = (slug: string, overrides: Record<string, unknown> = {}) => ({
  status: 'placeholder',
  file: `${slug}.jpg`,
  width: 99,
  height: 78,
  format: 'jpeg',
  alt: { fr: 'Traction stricte vue de dos.', en: 'Pull-up seen from behind.' },
  licence: 'unknown-dev-only',
  source: 'prototype ressources_images/traction.jpg',
  verified_by: 'AL',
  ...overrides,
});

const CATEGORIES = Object.fromEntries(
  ['upper', 'lower', 'core', 'recovery', 'mobility', 'running'].map((c) => [
    c,
    { status: 'fallback' },
  ]),
);

function manifest(
  exercises: Record<string, unknown>,
  rejected: { file: string; reason: string }[] = [],
) {
  return { version: 1, exercises, categories: CATEGORIES, rejected } as unknown as MediaManifest;
}

const run = (
  m: unknown,
  files: Record<string, ProbedFile> = { 'pull-up.jpg': { width: 99, height: 78, format: 'jpeg' } },
  production = false,
) =>
  checkMedia({
    manifest: m,
    exercises: [pullUp, plank],
    files: new Map(Object.entries(files)),
    production,
  });

const valid = () =>
  manifest({ 'pull-up': asset('pull-up'), plank: { status: 'fallback', reason: 'None yet.' } });

describe('checkMedia', () => {
  it('passes a valid manifest', () => {
    expect(run(valid())).toEqual([]);
  });

  it('rejects a malformed manifest', () => {
    expect(run({ ...valid(), categories: {} })[0]).toMatch(/^manifest categories/);
  });

  it('rule 1: every exercise has exactly one entry, and only exercises have entries', () => {
    expect(run(manifest({ 'pull-up': asset('pull-up') }))).toEqual([
      'plank: no manifest entry (rule 1)',
    ]);
    const extra = valid();
    extra.exercises['muscle-up'] = { status: 'fallback', reason: 'x' };
    expect(run(extra)).toEqual(['muscle-up: not an exercise in content/exercises (rule 1)']);
    const extraFile = valid();
    extraFile.exercises['muscle-up'] = asset('muscle-up') as never;
    expect(
      run(extraFile, {
        'pull-up.jpg': { width: 99, height: 78, format: 'jpeg' },
        'muscle-up.jpg': { width: 99, height: 78, format: 'jpeg' },
      }),
    ).toEqual(['muscle-up: not an exercise in content/exercises (rule 1)']);
  });

  it('rule 2: the file exists, decodes and matches the manifest', () => {
    expect(run(valid(), {})).toEqual(['pull-up: file "pull-up.jpg" is missing (rule 2)']);
    expect(
      run(valid(), { 'pull-up.jpg': { error: 'Input buffer contains unsupported image format' } }),
    ).toEqual([
      'pull-up: file "pull-up.jpg" does not decode: Input buffer contains unsupported image format (rule 2)',
    ]);
    expect(run(valid(), { 'pull-up.jpg': { width: 100, height: 78, format: 'jpeg' } })).toEqual([
      'pull-up: file "pull-up.jpg" is 100×78 jpeg, the manifest says 99×78 jpeg (rule 2)',
    ]);
    expect(run(valid(), { 'pull-up.jpg': { width: 99, height: 78, format: 'png' } })).toEqual([
      'pull-up: file "pull-up.jpg" is 99×78 png, the manifest says 99×78 jpeg (rule 2)',
    ]);
  });

  it('rule 3: no file is referenced by two slugs', () => {
    const m = manifest({
      'pull-up': asset('pull-up'),
      plank: asset('plank', { file: 'pull-up.jpg', alt: { fr: 'Planche.', en: 'Plank.' } }),
    });
    expect(run(m)).toEqual([
      'plank: file "pull-up.jpg" must be named plank (rule 4)',
      'plank: file "pull-up.jpg" is already used by pull-up (rule 3)',
    ]);
  });

  it('rule 3 / D19: a rejected file is never referenced', () => {
    const m = manifest(
      { 'pull-up': asset('pull-up'), plank: { status: 'fallback', reason: 'x' } },
      [{ file: 'pull-up.jpg', reason: 'Rejected.' }],
    );
    expect(run(m)).toEqual(['pull-up: file "pull-up.jpg" is rejected (rule 3, D19)']);
  });

  it('rule 4: the file stem equals the slug', () => {
    const m = manifest({
      'pull-up': asset('pull-up', { file: 'traction.jpg' }),
      plank: { status: 'fallback', reason: 'x' },
    });
    expect(run(m, { 'traction.jpg': { width: 99, height: 78, format: 'jpeg' } })).toEqual([
      'pull-up: file "traction.jpg" must be named pull-up (rule 4)',
    ]);
  });

  it('rule 5: alt text in FR and EN, naming the exercise, and a licence', () => {
    const noEnglish = valid();
    noEnglish.exercises['pull-up'] = asset('pull-up', {
      alt: { fr: 'Traction stricte.' },
    }) as never;
    expect(run(noEnglish)[0]).toMatch(/^manifest exercises\.pull-up\.alt\.en/);
    const wrongName = valid();
    wrongName.exercises['pull-up'] = asset('pull-up', {
      alt: { fr: 'Traction stricte.', en: 'A person on a bar.' },
    }) as never;
    expect(run(wrongName)).toEqual(['pull-up: alt.en must name "Pull-up" (rule 5)']);
    const noLicence = valid();
    noLicence.exercises['pull-up'] = asset('pull-up', { licence: '' }) as never;
    expect(run(noLicence)[0]).toMatch(/^manifest exercises\.pull-up\.licence/);
  });

  it('D27: a final asset is a 1,200 × 900 WebP with a real licence', () => {
    const final = (overrides: Record<string, unknown>) =>
      manifest({
        'pull-up': asset('pull-up', {
          status: 'final',
          file: 'pull-up.webp',
          format: 'webp',
          ...overrides,
        }),
        plank: { status: 'fallback', reason: 'x' },
      });
    const webp = (width: number, height: number) => ({
      'pull-up.webp': { width, height, format: 'webp' },
    });
    expect(
      run(
        final({ width: 1200, height: 900, licence: 'Commissioned, all rights assigned' }),
        webp(1200, 900),
      ),
    ).toEqual([]);
    expect(run(final({ licence: 'CC0' }), webp(99, 78))).toEqual([
      'pull-up: a final asset must be a 1,200 × 900 WebP (D27)',
    ]);
    expect(run(final({ width: 1200, height: 900 }), webp(1200, 900))).toEqual([
      'pull-up: licence "unknown-dev-only" is allowed only on a placeholder (D27)',
    ]);
  });

  it('rule 7 / D18: placeholders fail a production build and pass otherwise', () => {
    expect(run(valid(), undefined, false)).toEqual([]);
    expect(run(valid(), undefined, true)).toEqual([
      'pull-up: placeholder media is blocked in production builds (rule 7, D18)',
    ]);
  });

  it('AGENTS §8: a file that is not in the manifest fails', () => {
    expect(
      run(valid(), {
        'pull-up.jpg': { width: 99, height: 78, format: 'jpeg' },
        'mollets.jpg': { width: 99, height: 87, format: 'jpeg' },
      }),
    ).toEqual(['mollets.jpg: file is not in the manifest (AGENTS §8)']);
  });
});

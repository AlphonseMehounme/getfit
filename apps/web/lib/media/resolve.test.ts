import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkLibrary } from '../../../../content/schema/library-check';
import { readExerciseFiles } from '../../../../content/schema/load';
import { MEDIA_BASE_PATH, resolveExerciseMedia } from './resolve';

const exercises = checkLibrary(
  readExerciseFiles(fileURLToPath(new URL('../../../../content', import.meta.url))),
);
const resolveAll = (locale: 'fr' | 'en') =>
  exercises.map((e) => ({ slug: e.slug, media: resolveExerciseMedia(e.slug, e.category, locale) }));

describe('resolveExerciseMedia', () => {
  it('AGENTS §8: every exercise gets its own file or its category fallback', () => {
    for (const { slug, media } of resolveAll('fr')) {
      if (media.kind === 'image') expect(media.src).toBe(`${MEDIA_BASE_PATH}/${slug}.jpg`);
      else expect(media.category).toBe(exercises.find((e) => e.slug === slug)?.category);
    }
  });

  it('AGENTS §8: no two exercises share an image', () => {
    const srcs = resolveAll('en').flatMap(({ media }) =>
      media.kind === 'image' ? [media.src] : [],
    );
    expect(srcs).toHaveLength(10);
    expect(new Set(srcs).size).toBe(srcs.length);
  });

  it('D18 / D19: chin-up, easy walk and calf raise show their category fallback', () => {
    expect(resolveExerciseMedia('chin-up', 'upper', 'fr')).toEqual({
      kind: 'fallback',
      category: 'upper',
    });
    expect(resolveExerciseMedia('easy-walk', 'recovery', 'fr')).toEqual({
      kind: 'fallback',
      category: 'recovery',
    });
    expect(resolveExerciseMedia('standing-calf-raise', 'lower', 'en')).toEqual({
      kind: 'fallback',
      category: 'lower',
    });
  });

  it('an unknown slug falls back, never borrowing another image', () => {
    expect(resolveExerciseMedia('muscle-up', 'upper', 'en')).toEqual({
      kind: 'fallback',
      category: 'upper',
    });
    expect(resolveExerciseMedia('toString', 'core', 'en')).toEqual({
      kind: 'fallback',
      category: 'core',
    });
  });

  it('D15: alt text follows the locale and names the exercise', () => {
    const fr = resolveExerciseMedia('pull-up', 'upper', 'fr');
    const en = resolveExerciseMedia('pull-up', 'upper', 'en');
    expect(fr).toMatchObject({
      kind: 'image',
      src: '/media/exercises/pull-up.jpg',
      width: 99,
      height: 78,
    });
    expect(fr.kind === 'image' && fr.alt).toMatch(/^Traction stricte/);
    expect(en.kind === 'image' && en.alt).toMatch(/^Pull-up/);
  });
});

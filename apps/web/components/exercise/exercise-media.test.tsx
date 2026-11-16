// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { resolveExerciseMedia } from '@/lib/media/resolve';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { ExerciseMedia } from './exercise-media';

const CATEGORIES = ['upper', 'lower', 'core', 'recovery', 'mobility', 'running'] as const;

describe('ExerciseMedia', () => {
  it('AGENTS §8: shows the exercise’s own image from the manifest', async () => {
    const media = resolveExerciseMedia('pull-up', 'upper', 'en');
    const { container } = renderWithIntl(<ExerciseMedia media={media} exerciseName="Pull-up" />);
    const img = screen.getByRole('img', { name: /^Pull-up seen from behind/ });
    expect(img.getAttribute('src')).toContain(encodeURIComponent('/media/exercises/pull-up.jpg'));
    expect(img.getAttribute('width')).toBe('99');
    expect(img.getAttribute('height')).toBe('78');
    await expectNoAxeViolations(container);
  });

  it('D18 / D27: chin-up shows its category fallback, never the pull-up image', async () => {
    const media = resolveExerciseMedia('chin-up', 'upper', 'en');
    const { container } = renderWithIntl(<ExerciseMedia media={media} exerciseName="Chin-up" />);
    const fallback = screen.getByRole('img', { name: 'Chin-up: illustration coming soon' });
    expect(fallback.textContent).toBe('Illustration coming soon');
    expect(container.querySelector('img')).toBeNull();
    await expectNoAxeViolations(container);
  });

  it.each(CATEGORIES)('has a fallback icon for the %s category', (category) => {
    const { container } = renderWithIntl(
      <ExerciseMedia media={{ kind: 'fallback', category }} exerciseName="Exercise" />,
    );
    expect(container.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
  });

  it('D15: labels the fallback in French', () => {
    renderWithIntl(
      <ExerciseMedia
        media={{ kind: 'fallback', category: 'mobility' }}
        exerciseName="Mobilité des hanches"
      />,
      'fr',
    );
    expect(
      screen.getByRole('img', { name: 'Mobilité des hanches : illustration bientôt disponible' }),
    ).toBeTruthy();
  });
});

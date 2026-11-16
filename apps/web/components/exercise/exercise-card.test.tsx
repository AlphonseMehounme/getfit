// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { resolveExerciseMedia } from '@/lib/media/resolve';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { ExerciseCard } from './exercise-card';

describe('ExerciseCard', () => {
  it('shows the name, target, rest and the exercise’s media', async () => {
    const { container } = renderWithIntl(
      <ExerciseCard
        name="Pull-up"
        target="3 × 6"
        rest="Rest 2 min"
        media={resolveExerciseMedia('pull-up', 'upper', 'en')}
      />,
    );
    const card = screen.getByRole('article');
    expect(within(card).getByRole('heading', { level: 3, name: 'Pull-up' })).toBeTruthy();
    expect(within(card).getByText('3 × 6')).toBeTruthy();
    expect(within(card).getByText('Rest 2 min')).toBeTruthy();
    expect(within(card).getByRole('img', { name: /^Pull-up seen from behind/ })).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('works without rest, at heading level 4, with a fallback image', () => {
    renderWithIntl(
      <ExerciseCard
        name="Side plank"
        target="2 × 30 s per side"
        headingLevel={4}
        media={{ kind: 'fallback', category: 'core' }}
      />,
    );
    expect(screen.getByRole('heading', { level: 4, name: 'Side plank' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Side plank: illustration coming soon' })).toBeTruthy();
    expect(screen.queryByText(/Rest/)).toBeNull();
  });
});

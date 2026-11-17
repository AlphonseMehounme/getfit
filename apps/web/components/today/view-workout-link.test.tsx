// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithIntl } from '@/test/render';
import { ViewWorkoutLink } from './view-workout-link';

describe('ViewWorkoutLink', () => {
  it('opens the saved workout', () => {
    renderWithIntl(<ViewWorkoutLink href="/train/abc" />);
    expect(screen.getByRole('link', { name: 'View workout' }).getAttribute('href')).toBe(
      '/train/abc',
    );
  });
});

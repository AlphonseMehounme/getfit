// @vitest-environment jsdom
import { parseLocalDate as d } from '@getfit/domain';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { resolveExerciseMedia } from '@/lib/media/resolve';
import type { ExerciseDetail as Detail } from '@/server/services/library';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { ExerciseDetail } from './exercise-detail';
import { ExerciseHistory } from './exercise-history';
import { ExerciseResult } from './exercise-result';
import { LibraryFilters } from './library-filters';
import { LibraryShortcut } from './library-shortcut';

const OPTIONS = {
  categories: ['lower', 'upper'],
  equipment: ['bodyweight', 'pull_up_bar'],
  muscles: ['biceps', 'lats'],
  difficulties: ['beginner', 'intermediate'],
};

const PULL_UP: Detail = {
  id: 'ex-1',
  slug: 'pull-up',
  category: 'upper',
  difficulty: 'intermediate',
  equipment: ['pull_up_bar'],
  muscleGroups: ['lats', 'biceps'],
  isUnilateral: false,
  name: 'Pull-up',
  description: 'A bodyweight vertical pull.',
  instructions: ['Hang from the bar.', 'Pull your chest to the bar.'],
  commonMistakes: ['Swinging the legs.'],
  variations: [{ slug: 'chin-up', name: 'Chin-up' }],
  substitutes: [],
  media: resolveExerciseMedia('pull-up', 'upper', 'en'),
  history: [],
};

describe('LibraryFilters (PRD §6.7)', () => {
  it('a GET search with four filters; chosen values stay; Clear when filtered', async () => {
    const { container, unmount } = renderWithIntl(
      <LibraryFilters filters={{ query: 'traction', muscle: 'lats' }} options={OPTIONS} />,
    );
    const form = screen.getByRole('search');
    expect(form.getAttribute('method')).toBe('get');
    expect((screen.getByLabelText('Search') as HTMLInputElement).value).toBe('traction');
    expect((screen.getByLabelText('Muscle group') as HTMLSelectElement).value).toBe('lats');
    expect(
      within(screen.getByLabelText('Equipment')).getByRole('option', { name: 'Pull-up bar' }),
    ).toBeTruthy();
    expect(
      within(screen.getByLabelText('Category')).getByRole('option', { name: 'Upper body' }),
    ).toBeTruthy();
    expect(
      within(screen.getByLabelText('Difficulty')).getByRole('option', { name: 'Intermediate' }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Clear filters' }).getAttribute('href')).toBe(
      '/library',
    );
    await expectNoAxeViolations(container);
    unmount();
    renderWithIntl(<LibraryFilters filters={{}} options={OPTIONS} />);
    expect(screen.queryByRole('link', { name: 'Clear filters' })).toBeNull();
  });
});

describe('ExerciseResult', () => {
  it('the exercise with its media, category and difficulty; opens its page', async () => {
    const { container } = renderWithIntl(
      <ul>
        <ExerciseResult
          result={{
            slug: 'pull-up',
            name: 'Pull-up',
            category: 'upper',
            difficulty: 'intermediate',
            media: PULL_UP.media,
          }}
        />
      </ul>,
    );
    expect(screen.getByRole('link').getAttribute('href')).toBe('/library/pull-up');
    expect(screen.getByText('Upper body · Intermediate')).toBeTruthy();
    await expectNoAxeViolations(container);
  });
});

describe('ExerciseDetail (PRD §6.7, §8)', () => {
  it('media, description, steps, mistakes, muscles, equipment and variations', async () => {
    const { container } = renderWithIntl(<ExerciseDetail exercise={PULL_UP} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Pull-up' })).toBeTruthy();
    expect(screen.getByRole('img', { name: /Pull-up/ })).toBeTruthy();
    expect(
      within(screen.getByRole('region', { name: 'How to do it' })).getAllByRole('listitem'),
    ).toHaveLength(2);
    expect(screen.getByText('Swinging the legs.')).toBeTruthy();
    expect(screen.getByText('Lats, Biceps')).toBeTruthy();
    expect(screen.getByText('Pull-up bar')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Chin-up' }).getAttribute('href')).toBe(
      '/library/chin-up',
    );
    expect(screen.queryByRole('heading', { name: 'Can replace it' })).toBeNull();
    expect(screen.getByText('You haven’t logged this exercise yet.')).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('a fallback illustration names the exercise; per side; substitutes; no mistakes or variations', () => {
    renderWithIntl(
      <ExerciseDetail
        exercise={{
          ...PULL_UP,
          slug: 'chin-up',
          name: 'Chin-up',
          isUnilateral: true,
          commonMistakes: [],
          variations: [],
          substitutes: [{ slug: 'pull-up', name: 'Pull-up' }],
          media: resolveExerciseMedia('chin-up', 'upper', 'en'),
        }}
      />,
    );
    expect(screen.getByRole('img', { name: 'Chin-up: illustration coming soon' })).toBeTruthy();
    expect(screen.getByText(/Done on each side/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Pull-up' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Common mistakes' })).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Variations' })).toBeNull();
  });
});

describe('ExerciseHistory (BR-24, BR-25)', () => {
  it('the last sessions with the best set, each opening its workout', () => {
    renderWithIntl(
      <ExerciseHistory
        isRun={false}
        entries={[
          {
            workoutSessionId: 'w-1',
            date: d('2026-11-30'),
            setsLogged: 3,
            best: { kind: 'reps', reps: 8 },
          },
          {
            workoutSessionId: 'w-2',
            date: d('2026-11-23'),
            setsLogged: 1,
            best: { kind: 'seconds', seconds: 45 },
          },
          { workoutSessionId: 'w-3', date: d('2026-11-16'), setsLogged: 0, best: null },
        ]}
      />,
    );
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/train/w-1',
      '/train/w-2',
      '/train/w-3',
    ]);
    expect(screen.getByText('3 sets · best: 8 reps')).toBeTruthy();
    expect(screen.getByText('1 set · longest: 45 s')).toBeTruthy();
    expect(screen.getByText('0 sets')).toBeTruthy();
  });

  it('a run points to Train', () => {
    renderWithIntl(<ExerciseHistory isRun entries={[]} />);
    expect(
      screen.getByRole('link', { name: 'Your runs are listed in Train.' }).getAttribute('href'),
    ).toBe('/train');
  });
});

describe('LibraryShortcut', () => {
  it('opens the library', () => {
    renderWithIntl(<LibraryShortcut />);
    expect(screen.getByRole('link', { name: 'Exercise library' }).getAttribute('href')).toBe(
      '/library',
    );
  });
});

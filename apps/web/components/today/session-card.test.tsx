// @vitest-environment jsdom
import type { LocalDate, Prescription } from '@getfit/domain';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { TodaySession } from '@/server/services/schedule';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { SessionCard } from './session-card';

const rx = (overrides: Partial<Prescription>): Prescription => ({
  templateExerciseId: 'te-1',
  exerciseId: 'ex-1',
  sequence: 1,
  sets: 3,
  target: { kind: 'reps', reps: 6 },
  perSide: false,
  restS: 120,
  overridden: false,
  ...overrides,
});

const STRENGTH: TodaySession = {
  programmeDayId: 'day-1',
  title: 'Strength A — Upper body',
  sessionType: 'strength',
  bodyFocus: 'upper',
  purpose: 'Build pulling and pushing strength.',
  guidance: [],
  estimatedDurationMin: 40,
  status: 'scheduled',
  start: { allowed: true, mode: 'start' },
  movedFrom: null,
  workoutSessionId: null,
  runSessionId: null,
  canLogRun: false,
  exercises: [
    { slug: 'pull-up', category: 'upper', name: 'Pull-up', cues: [], prescription: rx({}) },
    {
      slug: 'side-plank',
      category: 'core',
      name: 'Side plank',
      cues: [],
      prescription: rx({
        templateExerciseId: 'te-2',
        sets: 2,
        target: { kind: 'duration', seconds: 30 },
        perSide: true,
        restS: null,
      }),
    },
  ],
};

describe('SessionCard', () => {
  it('BR-14 / BR-16: a strength session lists each exercise with its single target and media', async () => {
    const { container } = renderWithIntl(<SessionCard session={STRENGTH} units="metric" />);
    expect(screen.getByRole('heading', { level: 2, name: STRENGTH.title }).textContent).toBe(
      STRENGTH.title,
    );
    expect(screen.getByText('Strength · About 40 min')).toBeTruthy();
    expect(screen.getByText('Status: Planned')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Exercises' })).toBeTruthy();
    expect(screen.getByText('3 × 6')).toBeTruthy();
    expect(screen.getByText('Rest 2 min')).toBeTruthy();
    expect(screen.getByText('2 × 30 s per side')).toBeTruthy();
    // AGENTS §8: media by slug; the side plank has its own placeholder in the manifest.
    expect(screen.getByRole('img', { name: /pull-up/i })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Guidance' })).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('a recovery day shows its guidance, then the optional activities, in French', async () => {
    const recovery: TodaySession = {
      ...STRENGTH,
      title: 'Récupération et mobilité',
      sessionType: 'recovery',
      bodyFocus: 'none',
      estimatedDurationMin: null,
      status: 'rest',
      start: { allowed: false, reason: 'rest_day' },
      movedFrom: '2026-11-23' as LocalDate,
      guidance: ['Marche facile jusqu’à 30 min.'],
      exercises: [
        {
          slug: 'easy-walk',
          category: 'recovery',
          name: 'Marche facile',
          cues: [],
          prescription: rx({ sets: 1, target: { kind: 'duration', seconds: 1800 }, restS: null }),
        },
        {
          slug: 'long-run',
          category: 'running',
          name: 'Sortie longue',
          cues: [],
          prescription: rx({
            templateExerciseId: 'te-3',
            sets: 1,
            target: { kind: 'distance', metres: 10840 },
            restS: null,
          }),
        },
      ],
    };
    const { container } = renderWithIntl(<SessionCard session={recovery} units="metric" />, 'fr');
    expect(screen.getByText('Récupération')).toBeTruthy();
    expect(screen.getByText('Statut : Repos')).toBeTruthy();
    expect(screen.getByText('Déplacée depuis le lundi')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Conseils' })).toBeTruthy();
    expect(screen.getByText('Marche facile jusqu’à 30 min.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Facultatif' })).toBeTruthy();
    expect(screen.getByText('30 min')).toBeTruthy();
    // BR-15 and French number formatting: a ceiling, "10,8 km".
    expect(screen.getByText('Jusqu’à 10,8 km')).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('shows no exercise section when a day has none', () => {
    renderWithIntl(<SessionCard session={{ ...STRENGTH, exercises: [] }} units="metric" />);
    expect(screen.queryByRole('heading', { name: 'Exercises' })).toBeNull();
  });
});

// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ONBOARDING_STEPS } from '@/lib/onboarding/steps';
import type { StepActions } from '@/lib/onboarding/use-step-submit';
import type { OnboardingView } from '@/server/services/onboarding';
import { renderWithIntl } from '@/test/render';
import { StepForm } from './step-form';

const VIEW: OnboardingView = {
  profile: {
    first_name: 'Alex',
    birth_year: null,
    height_cm: 165,
    preferred_units: 'metric',
    locale: 'en',
    timezone: 'Etc/Unknown-Saved',
    experience_level: 'beginner',
    preferred_duration_min: null,
    onboarding_completed_at: null,
  },
  goals: ['maintain'],
  equipment: [],
  availability: {},
  baselines: { weight: null, tests: {}, run: null },
  missingEquipment: [],
  programmeAvailability: { 1: 'training', 7: 'running' },
  availabilityMismatches: [],
};
const TITLES = {
  profile: 'About you',
  goals: 'Your goals',
  experience: 'Your experience',
  equipment: 'Your equipment',
  availability: 'Your week',
  baselines: 'Your starting point',
} as const;

const actions = (mode?: 'settings'): StepActions => ({ save: vi.fn(), finish: vi.fn(), mode });

describe('StepForm (PRD §6.2, D35)', () => {
  it.each(ONBOARDING_STEPS)('renders the %s step', (step) => {
    renderWithIntl(<StepForm step={step} view={VIEW} currentYear={2026} actions={actions()} />);
    expect(screen.getByRole('heading', { level: 1, name: TITLES[step] })).toBeTruthy();
  });

  it('D36: availability pre-fills with the programme until answered, then with the answers', () => {
    const { unmount } = renderWithIntl(
      <StepForm step="availability" view={VIEW} currentYear={2026} actions={actions()} />,
    );
    expect((screen.getByLabelText('Sunday') as HTMLSelectElement).value).toBe('running');
    unmount();
    renderWithIntl(
      <StepForm
        step="availability"
        view={{ ...VIEW, availability: { 7: 'rest' } }}
        currentYear={2026}
        actions={actions()}
      />,
    );
    expect((screen.getByLabelText('Sunday') as HTMLSelectElement).value).toBe('rest');
  });

  it('keeps a saved time zone the runtime lacks; no height is empty', () => {
    renderWithIntl(
      <StepForm
        step="profile"
        view={{ ...VIEW, profile: { ...VIEW.profile, height_cm: null } }}
        currentYear={2026}
        actions={actions()}
      />,
    );
    expect((screen.getByLabelText('Time zone') as HTMLSelectElement).value).toBe(
      'Etc/Unknown-Saved',
    );
    expect((screen.getByLabelText('Height (cm)') as HTMLInputElement).value).toBe('');
  });

  it('D35 / BR-4: in Settings, no progress or Skip, Save and Cancel, and the time-zone note', () => {
    renderWithIntl(
      <StepForm step="profile" view={VIEW} currentYear={2026} actions={actions('settings')} />,
    );
    expect(screen.queryByRole('progressbar')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe('/profile');
    expect(screen.getByText(/Changing it never moves a session you have logged/)).toBeTruthy();
  });

  it('D35: a later step in Settings has no Skip', () => {
    renderWithIntl(
      <StepForm step="baselines" view={VIEW} currentYear={2026} actions={actions('settings')} />,
    );
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Skip' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Save' })).toBeTruthy();
  });
});

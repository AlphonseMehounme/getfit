// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SavedBaselines } from '@/lib/onboarding/baselines-form';
import type { OnboardingView } from '@/server/services/onboarding';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import {
  AboutSummary,
  EquipmentSummary,
  ExperienceSummary,
  GoalsSummary,
  WeekSummary,
} from './answers-summary';
import { BaselinesSummary } from './baselines-summary';
import { PreferencesForm } from './preferences-form';
import { ProfileSection } from './profile-section';

const PROFILE: OnboardingView['profile'] = {
  first_name: 'Alex',
  birth_year: 1998,
  height_cm: 165,
  preferred_units: 'metric',
  locale: 'en',
  timezone: 'America/New_York',
  experience_level: null,
  preferred_duration_min: null,
  onboarding_completed_at: '2026-11-19T10:00:00Z',
};
const NONE: SavedBaselines = {
  weight: null,
  maxPullUps: null,
  maxPushUps: null,
  maxSquats: null,
  run: null,
};

describe('Profile summaries (D35)', () => {
  it('about you, in metric and imperial; unknown values are "—"', () => {
    const { unmount } = renderWithIntl(<AboutSummary profile={PROFILE} />);
    expect(screen.getByText('Alex')).toBeTruthy();
    expect(screen.getByText('165 cm')).toBeTruthy();
    expect(screen.getByText('America/New York')).toBeTruthy();
    unmount();
    renderWithIntl(
      <AboutSummary
        profile={{ ...PROFILE, preferred_units: 'imperial', first_name: null, birth_year: null }}
      />,
    );
    expect(screen.getByText('5 ft 5 in')).toBeTruthy();
    expect(screen.getByText('Imperial')).toBeTruthy();
    expect(screen.getAllByText('—')).toHaveLength(2);
  });

  it('no height: "—"', () => {
    renderWithIntl(<AboutSummary profile={{ ...PROFILE, height_cm: null }} />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('choices by name, or "Not answered"', () => {
    renderWithIntl(
      <>
        <GoalsSummary goals={['build_muscle', 'improve_running']} />
        <GoalsSummary goals={[]} />
        <ExperienceSummary experience="advanced" />
        <ExperienceSummary experience={null} />
        <EquipmentSummary equipment={['pull_up_bar']} />
        <EquipmentSummary equipment={[]} />
      </>,
    );
    expect(screen.getByText('Build muscle and Improve running')).toBeTruthy();
    expect(screen.getByText('Advanced')).toBeTruthy();
    expect(screen.getByText('Pull-up bar')).toBeTruthy();
    expect(screen.getAllByText('Not answered')).toHaveLength(3);
  });

  it('the week: answered days and the length', () => {
    const { unmount } = renderWithIntl(
      <WeekSummary availability={{ 1: 'training', 7: 'running' }} preferredDurationMin={45} />,
    );
    expect(screen.getByText('Monday')).toBeTruthy();
    expect(screen.getByText('Run')).toBeTruthy();
    expect(screen.getByText('45 min')).toBeTruthy();
    unmount();
    renderWithIntl(<WeekSummary availability={{ 2: 'rest' }} preferredDurationMin={null} />);
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('the week, never answered', () => {
    renderWithIntl(<WeekSummary availability={{}} preferredDurationMin={null} />);
    expect(screen.getByText('Not answered')).toBeTruthy();
  });

  it('BR-26 / BR-23: baselines in the user units, with the run pace; none is "—"', () => {
    const saved: SavedBaselines = {
      weight: { id: 'w', weightKg: 55 },
      maxPullUps: { id: 'p', value: 10 },
      maxPushUps: null,
      maxSquats: null,
      run: { id: 'r', distanceM: 10_840, durationS: 4770, rpe: 7 },
    };
    const { unmount } = renderWithIntl(<BaselinesSummary saved={saved} units="metric" />);
    expect(screen.getByText('55')).toBeTruthy();
    expect(screen.getByText('10.84 km in 1:19:30 · 7:20 /km')).toBeTruthy();
    unmount();
    const imperial = renderWithIntl(<BaselinesSummary saved={saved} units="imperial" />);
    expect(screen.getByText('Weight (lb)')).toBeTruthy();
    expect(screen.getByText('121.3')).toBeTruthy();
    expect(screen.getByText('6.74 mi in 1:19:30 · 11:48 /mi')).toBeTruthy();
    imperial.unmount();
    renderWithIntl(<BaselinesSummary saved={NONE} units="metric" />);
    expect(screen.getAllByText('—')).toHaveLength(5);
  });

  it('a section names what its link edits', async () => {
    const { container } = renderWithIntl(
      <ProfileSection
        id="goals"
        title="Goals"
        editHref="/profile/edit/goals"
        editLabel="Answer now"
        editName="Answer now: Goals"
      >
        <p>Not answered</p>
      </ProfileSection>,
    );
    expect(screen.getByRole('heading', { level: 2, name: 'Goals' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Answer now: Goals' }).getAttribute('href')).toBe(
      '/profile/edit/goals',
    );
    await expectNoAxeViolations(container);
  });

  it('a section without a link', () => {
    renderWithIntl(
      <ProfileSection id="account" title="Account">
        <p>x</p>
      </ProfileSection>,
    );
    expect(screen.queryByRole('link')).toBeNull();
  });
});

describe('PreferencesForm (D15, D56)', () => {
  it('saves the language and the theme; Cancel goes back to Profile', async () => {
    const save = vi.fn(async () => undefined);
    const { container } = renderWithIntl(
      <PreferencesForm locale="fr" theme="system" save={save} />,
    );
    expect(screen.queryByText(/Step/)).toBeNull();
    expect((screen.getByRole('radio', { name: 'French' }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole('link', { name: 'Cancel' }).getAttribute('href')).toBe('/profile');
    await expectNoAxeViolations(container);
    await userEvent.click(screen.getByText('English'));
    await userEvent.click(screen.getByText('Dark'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(save).toHaveBeenCalledWith({ locale: 'en', theme: 'dark' }));
  });

  it('a failed save says so', async () => {
    const save = vi.fn(async () => ({ ok: false as const }));
    renderWithIntl(<PreferencesForm locale="en" theme="light" save={save} />);
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('Your answers could not be saved. Please try again.'),
    ).toBeTruthy();
  });
});

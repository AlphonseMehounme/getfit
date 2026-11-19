// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NextIntlClientProvider } from 'next-intl';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import en from '@/messages/en.json';
import type { StepActions } from '@/lib/onboarding/use-step-submit';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { type ProfileAnswers, ProfileStep } from './profile-step';

const EMPTY: ProfileAnswers = {
  firstName: null,
  birthYear: null,
  heightCm: null,
  units: 'metric',
  timezone: 'Europe/Paris',
};
const ZONES = ['America/New_York', 'Europe/Paris'];

function renderStep(answers: ProfileAnswers = EMPTY, result?: { ok: false }) {
  const actions: StepActions = {
    save: vi.fn(async () => result),
    finish: vi.fn(async () => undefined),
  };
  const view = renderWithIntl(
    <ProfileStep answers={answers} currentYear={2026} timeZones={ZONES} actions={actions} />,
  );
  return { ...view, actions };
}

const next = () => userEvent.click(screen.getByRole('button', { name: 'Next' }));

describe('ProfileStep (PRD §6.2 step 1)', () => {
  it('sends the first name with the defaults; empty numbers are not recorded', async () => {
    const { actions, container } = renderStep();
    expect(screen.getByText('Step 1 of 6')).toBeTruthy();
    expect((screen.getByLabelText('Time zone') as HTMLSelectElement).value).toBe('Europe/Paris');
    await expectNoAxeViolations(container);
    await userEvent.type(screen.getByLabelText('First name'), 'Sam');
    await userEvent.selectOptions(screen.getByLabelText('Time zone'), 'America/New_York');
    await next();
    await waitFor(() =>
      expect(actions.save).toHaveBeenCalledWith('profile', {
        firstName: 'Sam',
        birthYear: null,
        units: 'metric',
        timezone: 'America/New_York',
        height: null,
        heightUnit: 'cm',
      }),
    );
  });

  it('the first name is required, and a wrong year or height says so', async () => {
    const { actions, container } = renderStep();
    await userEvent.type(screen.getByLabelText('Year of birth'), '1899');
    await userEvent.type(screen.getByLabelText('Height (cm)'), '0');
    await next();
    expect(await screen.findByText('Enter your first name.')).toBeTruthy();
    expect(screen.getByText('Enter a year between 1900 and 2026.')).toBeTruthy();
    expect(screen.getByText('Enter a valid height.')).toBeTruthy();
    expect(actions.save).not.toHaveBeenCalled();
    await expectNoAxeViolations(container);
    await userEvent.type(screen.getByLabelText('First name'), 'x'.repeat(51));
    await next();
    expect(await screen.findByText('Use 50 characters or fewer.')).toBeTruthy();
  });

  it('imperial: height in feet and inches, sent in inches', async () => {
    const { actions } = renderStep();
    await userEvent.type(screen.getByLabelText('First name'), 'Sam');
    await userEvent.click(screen.getByText('Imperial'));
    expect(screen.queryByLabelText('Height (cm)')).toBeNull();
    await userEvent.type(screen.getByLabelText('Height (ft)'), '5');
    await userEvent.type(screen.getByLabelText('Height (in)'), '5');
    await next();
    await waitFor(() =>
      expect(actions.save).toHaveBeenCalledWith(
        'profile',
        expect.objectContaining({ units: 'imperial', height: 65, heightUnit: 'in' }),
      ),
    );
  });

  it('imperial with feet only, or with no height', async () => {
    const { actions } = renderStep({ ...EMPTY, firstName: 'Sam', units: 'imperial' });
    await next();
    await waitFor(() =>
      expect(actions.save).toHaveBeenLastCalledWith(
        'profile',
        expect.objectContaining({ height: null }),
      ),
    );
    await userEvent.type(screen.getByLabelText('Height (ft)'), '6');
    await next();
    await waitFor(() =>
      expect(actions.save).toHaveBeenLastCalledWith(
        'profile',
        expect.objectContaining({ height: 72, heightUnit: 'in' }),
      ),
    );
  });

  it('imperial with inches only', async () => {
    const { actions } = renderStep({ ...EMPTY, firstName: 'Sam', units: 'imperial' });
    await userEvent.type(screen.getByLabelText('Height (in)'), '70');
    await next();
    await waitFor(() =>
      expect(actions.save).toHaveBeenCalledWith(
        'profile',
        expect.objectContaining({ height: 70, heightUnit: 'in' }),
      ),
    );
  });

  it('a time zone the runtime does not know is refused with an explanation', async () => {
    const actions: StepActions = { save: vi.fn(), finish: vi.fn() };
    renderWithIntl(
      <ProfileStep
        answers={{ ...EMPTY, firstName: 'Sam', timezone: 'Mars/Olympus' }}
        currentYear={2026}
        timeZones={['Mars/Olympus', ...ZONES]}
        actions={actions}
      />,
    );
    await next();
    const error = await screen.findByText('Choose a time zone from the list.');
    expect(screen.getByLabelText('Time zone').getAttribute('aria-describedby')).toContain(error.id);
    expect(actions.save).not.toHaveBeenCalled();
  });

  it('D55: is pre-filled with what was saved, in the saved units', () => {
    renderStep({
      firstName: 'Alex',
      birthYear: 1998,
      heightCm: 165.1,
      units: 'imperial',
      timezone: 'America/New_York',
    });
    expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('Alex');
    expect((screen.getByLabelText('Year of birth') as HTMLInputElement).value).toBe('1998');
    expect((screen.getByLabelText('Height (ft)') as HTMLInputElement).value).toBe('5');
    expect((screen.getByLabelText('Height (in)') as HTMLInputElement).value).toBe('5');
  });

  it('a metric height is shown in cm', () => {
    renderStep({ ...EMPTY, heightCm: 165 });
    expect((screen.getByLabelText('Height (cm)') as HTMLInputElement).value).toBe('165');
  });

  it('a failed save shows a generic message', async () => {
    renderStep({ ...EMPTY, firstName: 'Sam' }, { ok: false });
    await next();
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Your answers could not be saved. Please try again.',
    );
  });

  it('the server HTML shows the saved answers, with every control disabled until interactive', () => {
    const html = renderToString(
      <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
        <ProfileStep
          answers={{ ...EMPTY, firstName: 'Alex', birthYear: 1998, timezone: 'America/New_York' }}
          currentYear={2026}
          timeZones={ZONES}
          actions={{ save: vi.fn(), finish: vi.fn() }}
        />
      </NextIntlClientProvider>,
    );
    const doc = new DOMParser().parseFromString(html, 'text/html');
    expect(doc.querySelector('fieldset')?.hasAttribute('disabled')).toBe(true);
    expect(doc.querySelector('button[type=submit]')?.hasAttribute('disabled')).toBe(true);
    expect(doc.querySelector<HTMLInputElement>('input[name=firstName]')?.value).toBe('Alex');
    expect(doc.querySelector<HTMLInputElement>('input[name=birthYear]')?.value).toBe('1998');
    expect(doc.querySelector<HTMLInputElement>('input[value=metric]')?.checked).toBe(true);
    expect(doc.querySelector<HTMLOptionElement>('option[value="America/New_York"]')?.selected).toBe(
      true,
    );
  });

  it('speaks French', () => {
    renderWithIntl(
      <ProfileStep
        answers={EMPTY}
        currentYear={2026}
        timeZones={ZONES}
        actions={{ save: vi.fn(), finish: vi.fn() }}
      />,
      'fr',
    );
    expect(screen.getByRole('heading', { level: 1, name: 'À propos de toi' })).toBeTruthy();
    expect(screen.getByText('Étape 1 sur 6')).toBeTruthy();
  });
});

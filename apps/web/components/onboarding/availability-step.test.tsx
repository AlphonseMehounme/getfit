// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { StepActions } from '@/lib/onboarding/use-step-submit';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { AvailabilityStep } from './availability-step';

// The launch programme's week (PRD §7), as `programmeAvailability` gives it.
const PROGRAMME = {
  1: 'training',
  2: 'rest',
  3: 'training',
  4: 'rest',
  5: 'training',
  6: 'rest',
  7: 'running',
} as const;

function renderStep(
  answer: Parameters<typeof AvailabilityStep>[0]['answer'],
  duration: number | null = null,
) {
  const actions: StepActions = {
    save: vi.fn(async () => undefined),
    finish: vi.fn(async () => undefined),
  };
  const view = renderWithIntl(
    <AvailabilityStep answer={answer} preferredDurationMin={duration} actions={actions} />,
  );
  return { ...view, actions };
}

const next = () => userEvent.click(screen.getByRole('button', { name: 'Next' }));

describe('AvailabilityStep (PRD §6.2 step 5, D36)', () => {
  it('D36: pre-filled with the programme days; Next saves them as answers', async () => {
    const { actions, container } = renderStep(PROGRAMME);
    expect(screen.getByText('Step 5 of 6')).toBeTruthy();
    expect((screen.getByLabelText('Monday') as HTMLSelectElement).value).toBe('training');
    expect((screen.getByLabelText('Sunday') as HTMLSelectElement).value).toBe('running');
    expect(screen.getByRole('link', { name: 'Skip' }).getAttribute('href')).toBe(
      '/onboarding/baselines',
    );
    await expectNoAxeViolations(container);
    await userEvent.click(screen.getByText('45 min'));
    await next();
    await waitFor(() =>
      expect(actions.save).toHaveBeenCalledWith('availability', {
        days: PROGRAMME,
        preferredDurationMin: 45,
      }),
    );
  });

  it('a day left unset is not sent; no length is null', async () => {
    const { actions } = renderStep({ 1: 'training' });
    expect((screen.getByLabelText('Tuesday') as HTMLSelectElement).value).toBe('');
    await userEvent.selectOptions(screen.getByLabelText('Monday'), '');
    await next();
    await waitFor(() =>
      expect(actions.save).toHaveBeenCalledWith('availability', {
        days: {},
        preferredDurationMin: null,
      }),
    );
  });

  it('PRD §6.2: one run day at most, explained under the days', async () => {
    const { actions, container } = renderStep(PROGRAMME);
    await userEvent.selectOptions(screen.getByLabelText('Saturday'), 'running');
    await next();
    expect(await screen.findByText('Choose one run day at most.')).toBeTruthy();
    expect(actions.save).not.toHaveBeenCalled();
    await expectNoAxeViolations(container);
  });

  it('a saved length outside the usual choices is kept and offered', () => {
    renderStep({}, 40);
    expect((screen.getByRole('radio', { name: '40 min' }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole('radio', { name: '30 min' })).toBeTruthy();
  });

  it('a saved usual length is checked', () => {
    renderStep({}, 60);
    expect((screen.getByRole('radio', { name: '60 min' }) as HTMLInputElement).checked).toBe(true);
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });
});

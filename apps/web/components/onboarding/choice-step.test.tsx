// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { StepActions } from '@/lib/onboarding/use-step-submit';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { ChoiceStep, type ChoiceStepSlug } from './choice-step';

function renderStep(step: ChoiceStepSlug, answer: readonly string[] | string | null) {
  const actions: StepActions = {
    save: vi.fn(async () => undefined),
    finish: vi.fn(async () => undefined),
  };
  const view = renderWithIntl(<ChoiceStep step={step} answer={answer} actions={actions} />);
  return { ...view, actions };
}

describe('ChoiceStep (PRD §6.2 steps 2–4)', () => {
  it('goals: several, pre-filled, saved as a list; Skip leads to step 3', async () => {
    const { actions, container } = renderStep('goals', ['improve_running']);
    expect(screen.getByText('Step 2 of 6')).toBeTruthy();
    expect((screen.getByLabelText('Improve running') as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole('link', { name: 'Skip' }).getAttribute('href')).toBe(
      '/onboarding/experience',
    );
    await expectNoAxeViolations(container);
    await userEvent.click(screen.getByText('Build muscle'));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(actions.save).toHaveBeenCalledWith('goals', {
        goals: ['build_muscle', 'improve_running'],
      }),
    );
  });

  it('experience: one level with its explanation; nothing chosen saves null', async () => {
    const { actions, container } = renderStep('experience', null);
    expect(screen.getByRole('radio', { name: 'Beginner' })).toBeTruthy();
    expect(
      screen.getByText('New to structured training, or coming back after a long break'),
    ).toBeTruthy();
    await expectNoAxeViolations(container);
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(actions.save).toHaveBeenCalledWith('experience', { experience: null }),
    );
    await userEvent.click(screen.getByText('Advanced'));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(actions.save).toHaveBeenLastCalledWith('experience', { experience: 'advanced' }),
    );
  });

  it('experience: pre-filled with the saved level', () => {
    renderStep('experience', 'intermediate');
    expect((screen.getByRole('radio', { name: 'Intermediate' }) as HTMLInputElement).checked).toBe(
      true,
    );
  });

  it('equipment: several, saved as a list; Skip leads to step 5', async () => {
    const { actions } = renderStep('equipment', []);
    expect(screen.getByText('Step 4 of 6')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Skip' }).getAttribute('href')).toBe(
      '/onboarding/availability',
    );
    await userEvent.click(screen.getByText('Pull-up bar'));
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(actions.save).toHaveBeenCalledWith('equipment', { equipment: ['pull_up_bar'] }),
    );
  });

  it('a saved list that is not an array is treated as empty', () => {
    renderStep('equipment', null);
    expect(screen.getAllByRole('checkbox').some((box) => (box as HTMLInputElement).checked)).toBe(
      false,
    );
  });
});

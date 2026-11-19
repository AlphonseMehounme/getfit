// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { StepShell } from './step-shell';

const base = {
  current: 2,
  total: 6,
  title: 'Your goals',
  intro: 'Choose as many as you like.',
  pending: false,
  failed: false,
  isLast: false,
  backHref: '/onboarding/profile',
};

describe('StepShell (PRD §6.2)', () => {
  it('shows the progress, the title, Back, Skip and Next', async () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    const { container } = renderWithIntl(
      <StepShell {...base} skip="/onboarding/experience" onSubmit={onSubmit}>
        <p>fields</p>
      </StepShell>,
    );
    expect(screen.getByRole('progressbar', { name: 'Step 2 of 6' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1, name: 'Your goals' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe(
      '/onboarding/profile',
    );
    expect(screen.getByRole('link', { name: 'Skip' }).getAttribute('href')).toBe(
      '/onboarding/experience',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onSubmit).toHaveBeenCalledOnce();
    await expectNoAxeViolations(container);
  });

  it('step 1 has neither Back nor Skip', () => {
    renderWithIntl(
      <StepShell {...base} current={1} backHref={null} onSubmit={vi.fn()}>
        <p>fields</p>
      </StepShell>,
    );
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Skip' })).toBeNull();
  });

  it('D54: on the last step, Finish submits and Skip finishes', async () => {
    const skip = vi.fn();
    renderWithIntl(
      <StepShell {...base} isLast skip={skip} onSubmit={vi.fn()}>
        <p>fields</p>
      </StepShell>,
    );
    expect(screen.getByRole('button', { name: 'Finish' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(skip).toHaveBeenCalledOnce();
  });

  it('while saving, the fields and buttons are disabled; a failure shows a generic alert', () => {
    renderWithIntl(
      <StepShell {...base} pending failed skip={vi.fn<() => void>()} onSubmit={vi.fn()}>
        <input aria-label="field" />
      </StepShell>,
    );
    expect(screen.getByRole('button', { name: 'Saving…' }).matches(':disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Skip' }).matches(':disabled')).toBe(true);
    expect(screen.getByRole('textbox', { name: 'field' }).matches(':disabled')).toBe(true);
    expect(screen.getByRole('alert').textContent).toBe(
      'Your answers could not be saved. Please try again.',
    );
  });
});

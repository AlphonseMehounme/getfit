// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { type StartChoice, StartForm, type StartFormState } from './start-form';

const CHOICES: StartChoice[] = [
  { mode: 'next_monday', label: 'Start on Monday, November 23', hint: 'Next Monday.' },
  { mode: 'this_week', label: 'Start this week', hint: 'Days already past are not scheduled.' },
];

describe('StartForm', () => {
  it('BR-2: offers each choice as a labelled button with its explanation', async () => {
    const action = vi.fn(async (): Promise<StartFormState> => null);
    const { container } = renderWithIntl(<StartForm choices={CHOICES} action={action} />);
    expect(screen.getByRole('group', { name: 'When do you want to start?' })).toBeTruthy();
    const first = screen.getByRole('button', { name: CHOICES[0]!.label });
    expect(first.getAttribute('aria-describedby')).toBe('start-next_monday-hint');
    expect(screen.getByText(CHOICES[1]!.hint)).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('sends the chosen mode, and shows a generic error when starting fails', async () => {
    let mode: FormDataEntryValue | null = null;
    const action = vi.fn(async (_state: StartFormState, data: FormData) => {
      mode = data.get('mode');
      return { error: true } as const;
    });
    renderWithIntl(<StartForm choices={CHOICES} action={action} />);
    await userEvent.click(screen.getByRole('button', { name: 'Start this week' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    expect(mode).toBe('this_week');
    expect(screen.getByRole('alert').textContent).toBe(
      'The programme could not be started. Please try again.',
    );
  });
});

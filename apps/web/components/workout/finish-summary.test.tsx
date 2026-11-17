// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { type FinishAction, FinishSummary, type FinishSummaryProps } from './finish-summary';

const SESSION = '3f1d2c3e-0000-4000-8000-000000000001';

function renderSummary(overrides: Partial<FinishSummaryProps> = {}, locale: 'en' | 'fr' = 'en') {
  const props: FinishSummaryProps = {
    sessionId: SESSION,
    progress: { prescribed: 12, logged: 12, complete: true },
    options: ['completed', 'partial'],
    totals: { sets: 12, reps: 100, holdSeconds: 90 },
    durationS: 2400,
    finish: vi.fn<FinishAction>(async () => ({ ok: true })),
    onBack: vi.fn(),
    onSaved: vi.fn(),
    ...overrides,
  };
  return { props, ...renderWithIntl(<FinishSummary {...props} />, locale) };
}

describe('FinishSummary', () => {
  it('PRD §6.5: shows what was done, and offers completed when every set is logged (D31)', async () => {
    const { container } = renderSummary();
    expect(screen.getByRole('heading', { name: 'Finish the workout' })).toBeTruthy();
    expect(screen.getByText('12 of 12 sets logged')).toBeTruthy();
    expect(screen.getByText('100 reps in total')).toBeTruthy();
    expect(screen.getByText('Duration 40:00')).toBeTruthy();
    expect(screen.getByText('90 s held')).toBeTruthy();
    expect(screen.getByText('Every set is logged.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Save as completed' })).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(10);
    await expectNoAxeViolations(container);
  });

  it('BR-5: saving sends the explicit confirmation with the effort and trimmed notes', async () => {
    const { props } = renderSummary();
    await userEvent.click(screen.getByRole('radio', { name: '7' }));
    await userEvent.type(screen.getByLabelText('Notes (optional)'), '  Felt strong  ');
    await userEvent.click(screen.getByRole('button', { name: 'Save as completed' }));
    await waitFor(() => expect(props.onSaved).toHaveBeenCalled());
    expect(props.finish).toHaveBeenCalledWith({
      sessionId: SESSION,
      save: 'completed',
      confirm: true,
      rpe: 7,
      notes: 'Felt strong',
    });
  });

  it('D31: with sets missing, only partial is offered; no effort or note is sent as null', async () => {
    const { props } = renderSummary({
      progress: { prescribed: 12, logged: 9, complete: false },
      options: ['partial'],
      totals: { sets: 9, reps: 60, holdSeconds: 0 },
    });
    expect(
      screen.getByText('3 sets are not logged, so this workout can be saved as partial.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Save as completed' })).toBeNull();
    expect(screen.queryByText(/held/)).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Save as partial' }));
    await waitFor(() => expect(props.onSaved).toHaveBeenCalled());
    expect(props.finish).toHaveBeenCalledWith(
      expect.objectContaining({ save: 'partial', rpe: null, notes: null }),
    );
  });

  it('keeps what was entered and says so when saving is refused or fails', async () => {
    const finish = vi
      .fn<FinishAction>()
      .mockResolvedValueOnce({ ok: false })
      .mockRejectedValueOnce(new Error('offline'));
    const { props } = renderSummary({ finish });
    await userEvent.click(screen.getByRole('radio', { name: '4' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save as completed' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'The workout could not be saved. Please try again.',
      ),
    );
    expect((screen.getByRole('radio', { name: '4' }) as HTMLInputElement).checked).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Save as partial' }));
    await waitFor(() => expect(finish).toHaveBeenCalledTimes(2));
    expect(props.onSaved).not.toHaveBeenCalled();
  });

  it('goes back to the workout, and speaks French', async () => {
    const { props } = renderSummary(
      { progress: { prescribed: 12, logged: 11, complete: false }, options: ['partial'] },
      'fr',
    );
    expect(
      screen.getByText(
        '1 série n’est pas enregistrée : cette séance peut être enregistrée comme partielle.',
      ),
    ).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Revenir à la séance' }));
    expect(props.onBack).toHaveBeenCalled();
  });

  it('D32: a reopened partial workout starts from the effort and notes it was saved with', async () => {
    const { props } = renderSummary({ initialRpe: 6, initialNotes: 'Short on time' });
    expect((screen.getByRole('radio', { name: '6' }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByLabelText('Notes (optional)') as HTMLTextAreaElement).value).toBe(
      'Short on time',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Save as completed' }));
    await waitFor(() => expect(props.onSaved).toHaveBeenCalled());
    expect(props.finish).toHaveBeenCalledWith(
      expect.objectContaining({ rpe: 6, notes: 'Short on time' }),
    );
  });
});

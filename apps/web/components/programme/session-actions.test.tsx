// @vitest-environment jsdom
import '@/test/dialog-shim';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { parseLocalDate as d } from '@getfit/domain';
import { DatePicker } from '@/components/ui/date-picker';
import type { MoveOptions } from '@/server/services/programme';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { type SessionActionHandlers, SessionActions } from './session-actions';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const DAY = '00000000-0000-4000-8000-000000000001';
const STRENGTH_B = 'Strength B — Lower and full body';

// Wed B on Thursday 26 Nov (PRD §5.3): Saturday is blocked twice; Sunday is allowed here for the test.
const OPTIONS: MoveOptions = {
  recommendation: 'move',
  candidates: [
    {
      date: d('2026-11-28'),
      allowed: false,
      blocks: [
        { rule: 'BR-10', reason: 'lower_body_before_run', blocker: null, blockerTitle: 'Long run' },
        {
          rule: 'BR-9',
          reason: 'strength_day_before',
          blocker: null,
          blockerTitle: 'Strength C — Upper body',
        },
      ],
    },
    { date: d('2026-11-29'), allowed: true, blocks: [] },
  ],
};
const NO_DATE: MoveOptions = {
  recommendation: 'skip',
  candidates: [
    {
      date: d('2026-11-24'),
      allowed: false,
      blocks: [
        { rule: 'BR-9', reason: 'strength_day_after', blocker: null, blockerTitle: STRENGTH_B },
      ],
    },
    {
      date: d('2026-11-30'),
      allowed: false,
      blocks: [{ rule: 'BR-12', reason: 'other_week', blocker: null, blockerTitle: null }],
    },
  ],
};

function handlers(overrides: Partial<SessionActionHandlers> = {}): SessionActionHandlers {
  return {
    move: vi.fn(async () => ({ ok: true as const })),
    skip: vi.fn(async () => ({ ok: true as const })),
    undo: vi.fn(async () => ({ ok: true as const })),
    ...overrides,
  };
}

function renderActions(
  props: Partial<Parameters<typeof SessionActions>[0]> = {},
  actions = handlers(),
) {
  const view = renderWithIntl(
    <SessionActions
      programmeDayId={DAY}
      plannedDate="2026-11-25"
      canMove
      canSkip
      canUndo={false}
      undoKind="moved"
      moveOptions={OPTIONS}
      actions={actions}
      {...props}
    />,
  );
  return { ...view, actions };
}

describe('SessionActions (PRD §6.4)', () => {
  it('BR-9 / BR-10: blocked days are disabled with each reason and rule; an allowed day moves', async () => {
    const { actions } = renderActions();
    await userEvent.click(screen.getByRole('button', { name: 'Move' }));
    const sheet = screen.getByRole('dialog', { name: 'Move this session' });
    const saturday = within(sheet).getByRole('radio', { name: 'Saturday, November 28' });
    expect((saturday as HTMLInputElement).disabled).toBe(true);
    expect(saturday.getAttribute('aria-describedby')).toBeTruthy();
    expect(
      within(sheet).getByText(
        'Within 2 days before Long run: legs stay fresh for the long run · Rule BR-10',
      ),
    ).toBeTruthy();
    expect(
      within(sheet).getByText(
        'Strength C — Upper body is the day before: no strength on consecutive days · Rule BR-9',
      ),
    ).toBeTruthy();
    await expectNoAxeViolations(sheet);
    const confirm = within(sheet).getByRole('button', { name: 'Move to this day' });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(within(sheet).getByText('Sunday, November 29'));
    await userEvent.click(confirm);
    await waitFor(() =>
      expect(actions.move).toHaveBeenCalledWith({ programmeDayId: DAY, date: '2026-11-29' }),
    );
    expect(await screen.findByText('Moved to Sunday, November 29.')).toBeTruthy();
    expect(refresh).toHaveBeenCalled();
  });

  it('BR-13: with no day left, recommends skipping, and Skip instead opens the skip dialog', async () => {
    const { actions } = renderActions({ moveOptions: NO_DATE });
    await userEvent.click(screen.getByRole('button', { name: 'Move' }));
    const sheet = screen.getByRole('dialog', { name: 'Move this session' });
    expect(within(sheet).getByText(/No day this week fits the recovery rules/)).toBeTruthy();
    expect(within(sheet).getByText('Outside this session’s week · Rule BR-12')).toBeTruthy();
    expect(within(sheet).queryByRole('button', { name: 'Move to this day' })).toBeNull();
    await userEvent.click(within(sheet).getByRole('button', { name: 'Skip instead' }));
    const dialog = await screen.findByRole('dialog', { name: 'Skip this session' });
    await userEvent.type(within(dialog).getByLabelText('Reason (optional)'), 'Travelling');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Skip this session' }));
    await waitFor(() =>
      expect(actions.skip).toHaveBeenCalledWith({ programmeDayId: DAY, reason: 'Travelling' }),
    );
    expect(await screen.findByText('Skipped.')).toBeTruthy();
  });

  it('BR-13 without a skip allowed: no Skip instead', async () => {
    renderActions({ moveOptions: NO_DATE, canSkip: false });
    await userEvent.click(screen.getByRole('button', { name: 'Move' }));
    expect(screen.queryByRole('button', { name: 'Skip instead' })).toBeNull();
  });

  it('D57: the skip reason is limited to 200 characters, said in words', async () => {
    const { container } = renderActions({ canMove: false, moveOptions: null });
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    const dialog = screen.getByRole('dialog', { name: 'Skip this session' });
    expect(within(dialog).getByText('Only you see it. 0 of 200 characters.')).toBeTruthy();
    const reason = within(dialog).getByLabelText('Reason (optional)');
    await userEvent.click(reason);
    await userEvent.paste('x'.repeat(201));
    expect(within(dialog).getByText('Use 200 characters or fewer.')).toBeTruthy();
    expect(
      (within(dialog).getByRole('button', { name: 'Skip this session' }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    await expectNoAxeViolations(container);
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('D38: undo a move or a skip', async () => {
    const { actions, unmount } = renderActions({ canMove: false, canSkip: false, canUndo: true });
    expect(screen.queryByRole('button', { name: 'Move' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Undo move' }));
    await waitFor(() => expect(actions.undo).toHaveBeenCalledWith({ programmeDayId: DAY }));
    expect(await screen.findByText('Back on Wednesday, November 25.')).toBeTruthy();
    unmount();
    renderActions({ canMove: false, canSkip: false, canUndo: true, undoKind: 'skipped' });
    expect(screen.getByRole('button', { name: 'Undo skip' })).toBeTruthy();
  });

  it('a refusal (the week changed) and a failure are explained', async () => {
    const actions = handlers({
      undo: vi.fn(async () => ({
        ok: false as const,
        error: 'not_undoable' as const,
        reason: 'past_date' as const,
      })),
      skip: vi.fn(async () => {
        throw new Error('network');
      }),
    });
    renderActions({ canMove: false, canUndo: true }, actions);
    await userEvent.click(screen.getByRole('button', { name: 'Undo move' }));
    expect(await screen.findByText(/This change isn’t possible any more/)).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Skip this session' })).getByRole('button', {
        name: 'Skip this session',
      }),
    );
    expect(
      await screen.findByText('The change could not be saved. Please try again.'),
    ).toBeTruthy();
  });

  it('bad input is an error, not a refusal', async () => {
    const actions = handlers({
      skip: vi.fn(async () => ({ ok: false as const, error: 'invalid_input' as const })),
    });
    renderActions({ canMove: false }, actions);
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Skip this session' })).getByRole('button', {
        name: 'Skip this session',
      }),
    );
    expect(
      await screen.findByText('The change could not be saved. Please try again.'),
    ).toBeTruthy();
  });

  it('the move sheet closes with Cancel or Escape, and nothing is saved', async () => {
    const { actions } = renderActions();
    await userEvent.click(screen.getByRole('button', { name: 'Move' }));
    await userEvent.click(
      within(screen.getByRole('dialog', { name: 'Move this session' })).getByRole('button', {
        name: 'Cancel',
      }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Move' }));
    // jsdom doesn't move focus into a modal as browsers do, so focus a control in it first.
    await userEvent.click(screen.getByText('Sunday, November 29'));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(actions.move).not.toHaveBeenCalled();
  });

  it('nothing allowed: no section at all', () => {
    const { container } = renderActions({ canMove: false, canSkip: false, canUndo: false });
    expect(container.textContent).toBe('');
  });

  it('can move but options failed to load: no Move button', () => {
    renderActions({ moveOptions: null });
    expect(screen.queryByRole('button', { name: 'Move' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Skip' })).toBeTruthy();
  });
});

describe('DatePicker', () => {
  it('a keyboard user moves between the allowed days only', async () => {
    const onChange = vi.fn();
    renderWithIntl(
      <DatePicker
        legend="Days this week"
        allowedLabel="Free"
        value="2026-11-26"
        onChange={onChange}
        options={[
          { value: '2026-11-25', label: 'Wednesday', allowed: false, reasons: ['Blocked'] },
          { value: '2026-11-26', label: 'Thursday', allowed: true, reasons: [] },
          { value: '2026-11-27', label: 'Friday', allowed: true, reasons: [] },
        ]}
      />,
    );
    expect(screen.getByRole('group', { name: 'Days this week' })).toBeTruthy();
    const thursday = screen.getByRole('radio', { name: 'Thursday' }) as HTMLInputElement;
    expect(thursday.checked).toBe(true);
    expect(screen.getAllByText('Free')).toHaveLength(2);
    thursday.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(onChange).toHaveBeenCalledWith('2026-11-27');
  });
});

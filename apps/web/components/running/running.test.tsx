// @vitest-environment jsdom
import '@/test/dialog-shim';
import { parseLocalDate as d } from '@getfit/domain';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { runFormDefaults } from '@/lib/running/run-form-values';
import type { RunLinkPrompt } from '@/server/services/running';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { DeleteRun } from './delete-run';
import { LogRunLink, ViewRunLink } from './run-links';
import { RunForm, type RunFormActions } from './run-form';
import { RunRecord } from './run-record';

const push = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, refresh }) }));

const RUN_ID = '00000000-0000-4000-8000-000000000001';
const SUNDAY = d('2026-11-29');
const LINK: RunLinkPrompt = {
  kind: 'link',
  programmeDayId: 'day-7',
  longRun: { title: 'Long run', date: SUNDAY },
};
const NONE: RunLinkPrompt = { kind: 'none', reason: 'no_long_run', longRun: null };

function renderForm(
  options: {
    prompt?: RunLinkPrompt | { kind: 'invalid' } | null;
    save?: RunFormActions['save'];
    unit?: 'km' | 'mi';
    keepsLink?: { date: string; note: string } | null;
    date?: string;
  } = {},
) {
  const actions: RunFormActions = {
    save: options.save ?? vi.fn(async () => ({ ok: true as const, linked: true })),
    linkOption: vi.fn(async () => (options.prompt === undefined ? NONE : options.prompt)),
  };
  const view = renderWithIntl(
    <RunForm
      runId={RUN_ID}
      initial={runFormDefaults(
        null,
        { date: options.date ?? '2026-11-29', time: '09:30' },
        options.unit ?? 'km',
      )}
      unit={options.unit ?? 'km'}
      keepsLink={options.keepsLink ?? null}
      submitLabel="Save run"
      actions={actions}
      recordPath={`/train/run/${RUN_ID}`}
    />,
  );
  return { ...view, actions };
}

async function typeReference() {
  await userEvent.type(screen.getByLabelText('Distance (km)'), '10.84');
  await userEvent.type(screen.getByLabelText('Hours'), '1');
  await userEvent.type(screen.getByLabelText('Minutes'), '19');
  await userEvent.type(screen.getByLabelText('Seconds'), '30');
}
const save = () => userEvent.click(screen.getByRole('button', { name: 'Save run' }));

describe('RunForm (PRD §6.6)', () => {
  it('AC: 10.84 km in 1:19:30 shows 7:20 /km and 8.2 km/h as typed; Yes links the run', async () => {
    const { actions, container } = renderForm({ prompt: LINK });
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.getByText('Enter a distance and a time to see your pace.')).toBeTruthy();
    await typeReference();
    expect(screen.getByText('7:20 /km')).toBeTruthy();
    expect(screen.getByText('8.2 km/h')).toBeTruthy();
    const question = await screen.findByRole('group', {
      name: 'Count this run as Long run on Sunday, November 29?',
    });
    await expectNoAxeViolations(container);
    await userEvent.click(within(question).getByText('Yes, count it'));
    await save();
    await waitFor(() =>
      expect(actions.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: RUN_ID,
          startedAt: '2026-11-29T09:30',
          distance: 10.84,
          distanceUnit: 'km',
          durationS: 4770,
          link: 'link',
        }),
      ),
    );
    expect(push).toHaveBeenCalledWith(`/train/run/${RUN_ID}`);
    expect(actions.linkOption).toHaveBeenCalledWith({ id: RUN_ID, startedAt: '2026-11-29T12:00' });
  });

  it('D33: a question must be answered; No keeps the run separate', async () => {
    const { actions } = renderForm({
      prompt: {
        kind: 'move_and_link',
        programmeDayId: 'day-7',
        date: d('2026-11-28'),
        longRun: LINK.longRun,
      },
    });
    await typeReference();
    await screen.findByRole('group', {
      name: 'Move Long run to Saturday, November 28 and count this run?',
    });
    await save();
    expect(await screen.findByText('Choose whether this run counts.')).toBeTruthy();
    expect(actions.save).not.toHaveBeenCalled();
    await userEvent.click(screen.getByText('No, keep it separate'));
    expect(screen.queryByText('Choose whether this run counts.')).toBeNull();
    await save();
    await waitFor(() =>
      expect(actions.save).toHaveBeenCalledWith(expect.objectContaining({ link: 'none' })),
    );
  });

  it('AC: 0 km is refused with a clear message; a half-typed run asks for both', async () => {
    const { actions } = renderForm();
    await userEvent.type(screen.getByLabelText('Distance (km)'), '0');
    await userEvent.type(screen.getByLabelText('Minutes'), '30');
    await save();
    expect(await screen.findByText('Enter a distance greater than 0.')).toBeTruthy();
    await userEvent.clear(screen.getByLabelText('Distance (km)'));
    await userEvent.clear(screen.getByLabelText('Minutes'));
    await userEvent.type(screen.getByLabelText('Seconds'), '0');
    await save();
    expect(await screen.findByText('Enter a time greater than 0.')).toBeTruthy();
    await userEvent.clear(screen.getByLabelText('Seconds'));
    await save();
    expect(await screen.findAllByText('Enter both a distance and a time.')).toHaveLength(2);
    expect(actions.save).not.toHaveBeenCalled();
  });

  it('a missing start time, and over-long text, say so', async () => {
    renderForm();
    await typeReference();
    await userEvent.clear(screen.getByLabelText('Start time'));
    await userEvent.type(screen.getByLabelText('Route (optional)'), 'x'.repeat(81));
    await userEvent.click(screen.getByLabelText('Notes (optional)'));
    await userEvent.paste('x'.repeat(1001));
    await save();
    expect(await screen.findByText('Enter a date and a start time.')).toBeTruthy();
    expect(screen.getByText('Use 80 characters or fewer.')).toBeTruthy();
    expect(screen.getByText('Use 1,000 characters or fewer.')).toBeTruthy();
  });

  it('BR-21: an unusual pace asks first; "Save anyway" saves', async () => {
    const { actions } = renderForm();
    await userEvent.type(screen.getByLabelText('Distance (km)'), '10');
    await userEvent.type(screen.getByLabelText('Minutes'), '10');
    await save();
    expect(await screen.findByText(/A pace of 1:00 \/km is unusually fast/)).toBeTruthy();
    expect(actions.save).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Save anyway' }));
    await waitFor(() => expect(actions.save).toHaveBeenCalledOnce());
  });

  it('failures: a future start, a changed week (asks again), and anything else', async () => {
    const save1 = vi
      .fn<RunFormActions['save']>()
      .mockResolvedValueOnce({ ok: false, error: 'future_start' })
      .mockResolvedValueOnce({ ok: false, error: 'link_unavailable' })
      .mockResolvedValueOnce({ ok: false, error: 'invalid_input' })
      .mockRejectedValueOnce(new Error('network'));
    const { actions } = renderForm({ save: save1 });
    await typeReference();
    await save();
    expect(
      await screen.findByText('This start is in the future. Check the date and time.'),
    ).toBeTruthy();
    await save();
    expect(
      await screen.findByText('Your week changed. Answer again whether this run counts.'),
    ).toBeTruthy();
    await waitFor(() => expect(actions.linkOption).toHaveBeenCalledTimes(2));
    await save();
    expect(await screen.findByText('The run could not be saved. Please try again.')).toBeTruthy();
    await save();
    await waitFor(() => expect(save1).toHaveBeenCalledTimes(4));
    expect(screen.getByText('The run could not be saved. Please try again.')).toBeTruthy();
  });

  it('nothing to offer: saved on its own; the reason shows when it would surprise', async () => {
    const { unmount } = renderForm({
      prompt: { ...NONE, reason: 'already_fulfilled', longRun: LINK.longRun },
    });
    expect(
      await screen.findByText(
        'Long run is already done this week, so this run is saved on its own.',
      ),
    ).toBeTruthy();
    unmount();
    const blocked = renderForm({ prompt: { ...NONE, reason: 'blocked', longRun: LINK.longRun } });
    expect(await screen.findByText(/Long run can’t move to this day/)).toBeTruthy();
    blocked.unmount();
    renderForm({ prompt: { kind: 'invalid' } });
    await waitFor(() => expect(screen.queryByText('Checking your week…')).toBeNull());
    expect(screen.queryByRole('group', { name: /count this run/ })).toBeNull();
  });

  it('while signed out the prompt says nothing', async () => {
    renderForm({ prompt: null });
    await waitFor(() => expect(screen.queryByText('Checking your week…')).toBeNull());
  });

  it('D60: editing on the same day keeps the link without asking; imperial units', async () => {
    const { actions } = renderForm({
      unit: 'mi',
      keepsLink: { date: '2026-11-29', note: 'Counts as Long run on Sunday, November 29' },
    });
    expect(screen.getByText('Counts as Long run on Sunday, November 29')).toBeTruthy();
    expect(actions.linkOption).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Distance (mi)'), '6.74');
    await userEvent.type(screen.getByLabelText('Hours'), '1');
    await userEvent.type(screen.getByLabelText('Minutes'), '19');
    // 4,740 s over 6.74 mi.
    expect(screen.getByText('11:43 /mi')).toBeTruthy();
    await save();
    await waitFor(() =>
      expect(actions.save).toHaveBeenCalledWith(
        expect.objectContaining({ distanceUnit: 'mi', link: 'none' }),
      ),
    );
  });

  it('an answer for an older date is ignored, and saving waits for the week check', async () => {
    let resolveFirst: (value: RunLinkPrompt) => void = () => {};
    const linkOption = vi
      .fn<RunFormActions['linkOption']>()
      .mockImplementationOnce(() => new Promise((resolve) => (resolveFirst = resolve)))
      .mockImplementation(() => new Promise(() => {}));
    const saveRun = vi.fn<RunFormActions['save']>();
    renderWithIntl(
      <RunForm
        runId={RUN_ID}
        initial={runFormDefaults(null, { date: '2026-11-29', time: '09:30' }, 'km')}
        unit="km"
        keepsLink={null}
        submitLabel="Save run"
        actions={{ save: saveRun, linkOption }}
        recordPath="/x"
      />,
    );
    const date = screen.getByLabelText('Date');
    await userEvent.clear(date);
    await userEvent.type(date, '2026-11-28');
    resolveFirst(LINK);
    await typeReference();
    // Save waits while the week is checked; Enter in a field doesn't submit either.
    expect((screen.getByRole('button', { name: 'Save run' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    await userEvent.type(screen.getByLabelText('Distance (km)'), '{Enter}');
    expect(screen.getByText('Checking your week…')).toBeTruthy();
    expect(screen.queryByRole('group', { name: /Count this run/ })).toBeNull();
    expect(saveRun).not.toHaveBeenCalled();
  });

  it('a date cleared waits without asking', async () => {
    const { actions } = renderForm();
    await waitFor(() => expect(actions.linkOption).toHaveBeenCalledOnce());
    await userEvent.clear(screen.getByLabelText('Date'));
    expect(actions.linkOption).toHaveBeenCalledOnce();
  });
});

describe('RunRecord (PRD §6.6, BR-22)', () => {
  const RUN = {
    date: '2026-11-29',
    time: '09:30',
    distanceM: 10_840,
    durationS: 4770,
    rpe: 5,
    routeName: 'Canal',
    notes: 'Easy',
    countsFor: { title: 'Long run', date: '2026-11-29' },
  };

  it('the run with pace and speed, and what it counts for', async () => {
    const { container } = renderWithIntl(
      <RunRecord
        run={RUN}
        unit="km"
        editHref="/edit"
        deleteControl={<button type="button">Delete run</button>}
      />,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Run on Sunday, November 29' }),
    ).toBeTruthy();
    expect(screen.getByText('Started at 09:30')).toBeTruthy();
    expect(screen.getByText('10.84 km')).toBeTruthy();
    expect(screen.getByText('1:19:30')).toBeTruthy();
    expect(screen.getByText('7:20 /km')).toBeTruthy();
    expect(screen.getByText('8.2 km/h')).toBeTruthy();
    expect(screen.getByText('5/10')).toBeTruthy();
    expect(screen.getByText('Counts as Long run on Sunday, November 29')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Edit run' }).getAttribute('href')).toBe('/edit');
    await expectNoAxeViolations(container);
  });

  it('in miles, unlinked, with nothing optional entered', () => {
    renderWithIntl(
      <RunRecord
        run={{ ...RUN, rpe: null, routeName: null, notes: null, countsFor: null }}
        unit="mi"
        editHref="/edit"
        deleteControl={null}
      />,
    );
    expect(screen.getByText('6.74 mi')).toBeTruthy();
    expect(screen.getByText('11:48 /mi')).toBeTruthy();
    expect(screen.getByText('Not linked to the programme')).toBeTruthy();
    expect(screen.getAllByText('—')).toHaveLength(3);
  });
});

describe('DeleteRun (PRD §6.6)', () => {
  it('asks first; Keep it keeps the run, Delete deletes it', async () => {
    const deleteRun = vi.fn(async () => ({ ok: true as const }));
    renderWithIntl(<DeleteRun runId={RUN_ID} deleteRun={deleteRun} afterPath="/today" />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete run' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete this run?' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Keep it' }));
    expect(deleteRun).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Delete run' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete run' }),
    );
    await waitFor(() => expect(deleteRun).toHaveBeenCalledWith({ id: RUN_ID }));
    expect(push).toHaveBeenCalledWith('/today');
  });

  it('a delete that throws says so too', async () => {
    const deleteRun = vi.fn(async () => {
      throw new Error('network');
    });
    renderWithIntl(<DeleteRun runId={RUN_ID} deleteRun={deleteRun} afterPath="/today" />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete run' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete run' }),
    );
    expect(await screen.findByText('The run could not be deleted. Please try again.')).toBeTruthy();
  });

  it('a failed delete says so', async () => {
    const deleteRun = vi.fn(async () => ({ ok: false as const, error: 'not_found' as const }));
    renderWithIntl(<DeleteRun runId={RUN_ID} deleteRun={deleteRun} afterPath="/today" />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete run' }));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete run' }),
    );
    expect(await screen.findByText('The run could not be deleted. Please try again.')).toBeTruthy();
  });
});

describe('run links', () => {
  it('Log run opens the form for the day; View run opens the run', () => {
    renderWithIntl(
      <>
        <LogRunLink date="2026-11-29" />
        <ViewRunLink runId={RUN_ID} />
      </>,
    );
    expect(screen.getByRole('link', { name: 'Log run' }).getAttribute('href')).toBe(
      '/train/run/new?date=2026-11-29',
    );
    expect(screen.getByRole('link', { name: 'View run' }).getAttribute('href')).toBe(
      `/train/run/${RUN_ID}`,
    );
  });
});

// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import type { RetestsView } from '@/server/services/tests';
import { d } from './fixture';
import { RetestsSection } from './retests-section';

type Save = (input: unknown) => Promise<{ ok: boolean }>;
const UUID = /^[0-9a-f-]{36}$/;
const view = (offered: boolean, logged = true): RetestsView => ({
  offered,
  tests: [
    {
      field: 'maxPullUps',
      baseline: { value: 10, date: d('2026-11-20') },
      latest: logged ? { value: 12, date: d('2027-01-11') } : null,
      change: logged ? 2 : null,
    },
    {
      field: 'maxPushUps',
      baseline: { value: 20, date: d('2026-11-20') },
      latest: logged ? { value: 20, date: d('2027-01-11') } : null,
      change: logged ? 0 : null,
    },
    {
      field: 'maxSquats',
      baseline: null,
      latest: logged ? { value: 40, date: d('2027-01-11') } : null,
      change: null,
    },
  ],
});
const results = () => screen.getAllByRole('definition').map((dd) => dd.textContent);

describe('RetestsSection (D73)', () => {
  it('BR-26: in week 8, the form and each result against its baseline', async () => {
    const { container } = renderWithIntl(<RetestsSection retests={view(true)} save={vi.fn()} />);
    expect(screen.getByRole('heading', { name: 'Re-tests' })).toBeTruthy();
    expect(screen.getByText(/you don’t need to go to failure/)).toBeTruthy();
    expect(screen.getByLabelText('Pull-ups')).toBeTruthy();
    expect(results()).toEqual([
      '12 · baseline 10 (+2)',
      '20 · baseline 20 (0)',
      '40 · no baseline',
    ]);
    await expectNoAxeViolations(container);
  });

  it('in week 8 before any re-test: "not re-tested yet"', () => {
    renderWithIntl(<RetestsSection retests={view(true, false)} save={vi.fn()} />);
    expect(results()).toEqual(['Not re-tested yet', 'Not re-tested yet', 'Not re-tested yet']);
  });

  it('after week 8, the results stay without the form; with no result, nothing is shown', () => {
    const { unmount } = renderWithIntl(<RetestsSection retests={view(false)} save={vi.fn()} />);
    expect(
      screen.getByText('Your week-8 re-tests, compared with your starting point.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    unmount();
    const { container } = renderWithIntl(
      <RetestsSection retests={view(false, false)} save={vi.fn()} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('in French', () => {
    renderWithIntl(<RetestsSection retests={view(true)} save={vi.fn()} />, 'fr');
    expect(screen.getByRole('heading', { name: 'Nouveaux tests' })).toBeTruthy();
    expect(results()[0]).toBe('12 · référence 10 (+2)');
  });
});

describe('RetestForm (D73)', () => {
  it('sends only the results given, each with a new device ID, then clears and confirms', async () => {
    const save = vi.fn<Save>(async () => ({ ok: true }));
    renderWithIntl(<RetestsSection retests={view(true, false)} save={save} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Pull-ups'), '12');
    await user.type(screen.getByLabelText('Squats'), '40');
    await user.click(screen.getByRole('button', { name: 'Save re-tests' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Re-tests saved.'));
    const first = save.mock.calls[0]![0] as Record<string, { id: string; value: number }>;
    expect(Object.keys(first)).toEqual(['maxPullUps', 'maxSquats']);
    expect(first.maxPullUps).toEqual({ id: expect.stringMatching(UUID), value: 12 });
    expect(first.maxSquats!.value).toBe(40);
    expect((screen.getByLabelText('Pull-ups') as HTMLInputElement).value).toBe('');

    // Logged again: new IDs, so it is a new re-test and the latest counts.
    await user.type(screen.getByLabelText('Pull-ups'), '13');
    await user.click(screen.getByRole('button', { name: 'Save re-tests' }));
    await waitFor(() => expect(save).toHaveBeenCalledTimes(2));
    const second = save.mock.calls[1]![0] as typeof first;
    expect(second.maxPullUps!.id).not.toBe(first.maxPullUps!.id);
  });

  it('asks for at least one result, and a whole number from 0 to 500', async () => {
    const save = vi.fn<Save>(async () => ({ ok: true }));
    renderWithIntl(<RetestsSection retests={view(true, false)} save={save} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Save re-tests' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Enter at least one result.');
    await user.type(screen.getByLabelText('Push-ups'), '501');
    await user.click(screen.getByRole('button', { name: 'Save re-tests' }));
    expect(await screen.findByText('Enter a whole number from 0 to 500.')).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
  });

  it('a failed save says so and keeps the values', async () => {
    const save = vi.fn<Save>(async () => ({ ok: false }));
    renderWithIntl(<RetestsSection retests={view(true, false)} save={save} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Pull-ups'), '12');
    await user.click(screen.getByRole('button', { name: 'Save re-tests' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'The re-tests couldn’t be saved. Try again.',
    );
    expect((screen.getByLabelText('Pull-ups') as HTMLInputElement).value).toBe('12');
  });
});

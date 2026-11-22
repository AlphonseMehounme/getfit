// @vitest-environment jsdom
import type { LocalDate, WeekSummary } from '@getfit/domain';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ReviewCard } from '@/components/progress/review-card';
import type { ReviewRecord } from '@/server/services/review';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { CheckInForm, type SaveReview } from './check-in-form';
import { CheckedIn } from './checked-in';
import { Insights } from './insights';
import { PainMessage } from './pain-message';
import { Recommendation } from './recommendation';
import { ReviewSummary } from './review-summary';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const summary = (overrides: Partial<WeekSummary> = {}): WeekSummary => ({
  planned: 4,
  completed: 1,
  partial: 1,
  missed: 2,
  skipped: 0,
  strengthSessions: 2,
  runs: 1,
  distanceM: 10_840,
  longestRunM: { available: true, value: 10_840 },
  strengthSets: 24,
  averageRpe: { available: true, value: 6.5 },
  weightChangeKg: { available: true, value: -0.5 },
  ...overrides,
});
const figures = (container: HTMLElement) =>
  [...container.querySelectorAll('dl > div')].map((f) => f.textContent);
const UUID = /^[0-9a-f-]{36}$/;
const stored: ReviewRecord = {
  id: '00000000-0000-4000-8000-000000000001',
  weekStart: '2026-11-23' as LocalDate,
  fatigue: 3,
  soreness: null,
  sleep: 4,
  motivation: 5,
  pain: true,
  painArea: 'knee',
  painNote: 'Left knee',
  notes: 'Good week',
  recommendationKey: 'reduce_or_rest',
  suggestion: null,
  suggestionDecision: null,
  weight: { id: '00000000-0000-4000-8000-000000000002', kg: 54.5, at: new Date() },
};

describe('ReviewSummary (PRD §6.9, BR-24, D63)', () => {
  it('the week in figures, in km and kg', async () => {
    const { container } = renderWithIntl(<ReviewSummary summary={summary()} units="metric" />);
    expect(figures(container)).toEqual([
      'Sessions done2 of 41 partly done',
      'Missed2',
      'Skipped0',
      'Strength sessions2',
      'Runs1',
      'Distance10.8 km',
      'Longest run10.8 km',
      'Average effort6.5 / 10',
      'Weight change-0.5 kg',
    ]);
    await expectNoAxeViolations(container);
  });

  it('in miles and pounds; unavailable values are "—" with their reason, never 0', () => {
    const { container } = renderWithIntl(
      <ReviewSummary
        summary={summary({
          planned: 0,
          partial: 0,
          distanceM: 0,
          longestRunM: { available: false },
          averageRpe: { available: false },
          weightChangeKg: { available: false },
        })}
        units="imperial"
      />,
    );
    expect(figures(container)).toEqual([
      'Sessions done—No training session planned this week.',
      'Missed2',
      'Skipped0',
      'Strength sessions2',
      'Runs1',
      'Distance0 mi',
      'Longest run—No run logged this week.',
      'Average effort—No effort logged this week.',
      'Weight change—Enter your weight to see the change.',
    ]);
  });

  it('a gain in pounds', () => {
    const { container } = renderWithIntl(
      <ReviewSummary
        summary={summary({ weightChangeKg: { available: true, value: 1 }, partial: 0 })}
        units="imperial"
      />,
    );
    expect(figures(container)[0]).toBe('Sessions done1 of 4');
    expect(figures(container)[8]).toBe('Weight change+2.2 lb');
  });
});

describe('CheckInForm (PRD §6.9, D72)', () => {
  const ok: SaveReview = async () => ({ ok: true });

  it('scales, pain and weight are sent as the server expects, with the device IDs', async () => {
    const save = vi.fn<SaveReview>(ok);
    const { container } = renderWithIntl(
      <CheckInForm weekStart="2026-11-23" stored={null} units="metric" save={save} />,
    );
    await expectNoAxeViolations(container);
    const user = userEvent.setup();
    const fatigue = screen.getByRole('group', { name: 'Fatigue' });
    expect(within(fatigue).getByText('1 = none · 5 = extreme')).toBeTruthy();
    await user.click(within(fatigue).getByRole('radio', { name: '2' }));
    await user.keyboard('{ArrowRight}');
    expect((within(fatigue).getByRole('radio', { name: '3' }) as HTMLInputElement).checked).toBe(
      true,
    );
    expect(screen.queryByLabelText('Where?')).toBeNull();
    await user.click(screen.getByRole('radio', { name: 'Yes' }));
    // Pain needs where it hurts.
    await user.click(screen.getByRole('button', { name: 'Save check-in' }));
    expect(await screen.findByText('Choose where it hurts.')).toBeTruthy();
    expect(save).not.toHaveBeenCalled();
    await user.selectOptions(screen.getByLabelText('Where?'), 'knee');
    await user.type(screen.getByLabelText('Note (optional)'), ' Left knee ');
    await user.type(screen.getByLabelText('Weight (kg, optional)'), '54.5');
    await user.type(screen.getByLabelText('Notes (optional)'), 'Tired');
    await user.click(screen.getByRole('button', { name: 'Save check-in' }));
    await waitFor(() => expect(screen.getByRole('status').textContent).toBe('Check-in saved.'));
    expect(save).toHaveBeenCalledWith({
      id: expect.stringMatching(UUID),
      weekStart: '2026-11-23',
      fatigue: 3,
      soreness: null,
      sleep: null,
      motivation: null,
      pain: true,
      painArea: 'knee',
      painNote: 'Left knee',
      notes: 'Tired',
      weight: { id: expect.stringMatching(UUID), value: 54.5, unit: 'kg' },
    });
    expect(refresh).toHaveBeenCalled();
  });

  it('pre-filled from the saved review; pain set to no sends no details; a weight in lb', async () => {
    const save = vi.fn<SaveReview>(ok);
    renderWithIntl(
      <CheckInForm weekStart="2026-11-23" stored={stored} units="imperial" save={save} />,
    );
    const user = userEvent.setup();
    expect((screen.getByLabelText('Where?') as HTMLSelectElement).value).toBe('knee');
    expect((screen.getByLabelText('Weight (lb, optional)') as HTMLInputElement).value).toBe(
      '120.2',
    );
    expect(
      (
        within(screen.getByRole('group', { name: 'Motivation' })).getByRole('radio', {
          name: '5',
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    await user.click(screen.getByRole('radio', { name: 'No' }));
    await user.clear(screen.getByLabelText('Notes (optional)'));
    await user.click(screen.getByRole('button', { name: 'Save check-in' }));
    await waitFor(() => expect(save).toHaveBeenCalled());
    expect(save.mock.calls[0]![0]).toMatchObject({
      id: stored.id,
      pain: false,
      painArea: null,
      painNote: null,
      notes: null,
      fatigue: 3,
      weight: { id: stored.weight!.id, value: 120.2, unit: 'lb' },
    });
  });

  it('a saved review without pain or weight: "No" is checked and no pain details show', () => {
    renderWithIntl(
      <CheckInForm
        weekStart="2026-11-23"
        stored={{
          ...stored,
          soreness: 2,
          pain: false,
          painArea: null,
          painNote: null,
          weight: null,
        }}
        units="metric"
        save={ok}
      />,
    );
    expect((screen.getByRole('radio', { name: 'No' }) as HTMLInputElement).checked).toBe(true);
    expect(
      (
        within(screen.getByRole('group', { name: 'Soreness' })).getByRole('radio', {
          name: '2',
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(screen.queryByLabelText('Where?')).toBeNull();
    expect((screen.getByLabelText('Weight (kg, optional)') as HTMLInputElement).value).toBe('');
  });

  it('a weight out of range, a closed window and a failed save say so', async () => {
    const save = vi.fn<SaveReview>(async () => ({ ok: false, error: 'closed' }));
    renderWithIntl(<CheckInForm weekStart="2026-11-23" stored={null} units="metric" save={save} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Weight (kg, optional)'), '1000');
    await user.click(screen.getByRole('button', { name: 'Save check-in' }));
    expect(await screen.findByText('Enter a weight between 1 and 999.')).toBeTruthy();
    await user.clear(screen.getByLabelText('Weight (kg, optional)'));
    await user.click(screen.getByRole('button', { name: 'Save check-in' }));
    expect((await screen.findByRole('alert')).textContent).toBe(
      'This review has closed, so it can’t be saved.',
    );
    save.mockResolvedValueOnce({ ok: false, error: 'failed' });
    await user.click(screen.getByRole('button', { name: 'Save check-in' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toBe(
        'The check-in couldn’t be saved. Try again.',
      ),
    );
  });
});

describe('Insights, recommendation and pain (D64, D69, BR-27)', () => {
  it('D69: each insight shows its rule when opened', async () => {
    const { container } = renderWithIntl(
      <Insights insights={['missed_sessions', 'recovery_low']} />,
    );
    const details = container.querySelectorAll('details');
    expect(details).toHaveLength(2);
    expect(details[0]!.open).toBe(false);
    await userEvent.setup().click(screen.getByText('Two or more sessions were missed'));
    expect(details[0]!.open).toBe(true);
    expect(
      within(details[0] as HTMLElement).getByText(/At least two planned training sessions/),
    ).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('with no insight, says so', () => {
    renderWithIntl(<Insights insights={[]} />);
    expect(screen.getByText('Nothing stood out this week.')).toBeTruthy();
  });

  it.each([
    ['reduce_or_rest', 'Reduce or rest'],
    ['add_recovery_day', 'Add a recovery day'],
    ['reduce_sets', 'Reduce sets next week'],
    ['keep_distance_stable', 'Keep your running distance stable'],
    ['accept_progression', 'One small progression'],
    ['maintain', 'Maintain the workload'],
  ] as const)('D64: %s → "%s"', (key, title) => {
    renderWithIntl(<Recommendation recommendation={key} />);
    expect(screen.getByText(title)).toBeTruthy();
  });

  it('BR-27 / D72: pain is named, with no diagnosis, and advice to seek a professional if it lasts', async () => {
    const { container } = renderWithIntl(<PainMessage area="knee" />);
    expect(container.textContent).toContain(
      'You reported pain (knee). Reduce your training or rest.',
    );
    expect(container.textContent).toContain('seek advice from a health professional');
    expect(container.textContent).not.toMatch(/injur|tendin|strain|sprain|diagnos(e|is)\b/i);
    await expectNoAxeViolations(container);
    renderWithIntl(<PainMessage area={null} />, 'fr');
    expect(screen.getByText(/Tu as signalé une douleur \(autre\)/)).toBeTruthy();
  });
});

describe('CheckedIn and the review card', () => {
  it('D68: a closed review lists its answers, read-only', () => {
    const { container } = renderWithIntl(<CheckedIn review={stored} />);
    expect(figures(container)).toEqual([
      'Fatigue3 / 5',
      'Soreness—',
      'Sleep quality4 / 5',
      'Motivation5 / 5',
    ]);
    expect(screen.getByText('Pain: Knee')).toBeTruthy();
    expect(screen.getByText('Good week')).toBeTruthy();
    expect(container.querySelector('input, button')).toBeNull();
  });

  it('without pain or notes', () => {
    renderWithIntl(<CheckedIn review={{ ...stored, pain: false, painArea: null, notes: null }} />);
    expect(screen.getByText('No pain reported')).toBeTruthy();
  });

  it('a closed review with pain but no area says "Other"', () => {
    renderWithIntl(<CheckedIn review={{ ...stored, painArea: null }} />);
    expect(screen.getByText('Pain: Other')).toBeTruthy();
  });

  it('leads to the open review, ready or to edit', () => {
    const { unmount } = renderWithIntl(
      <ReviewCard review={{ weekStart: '2026-11-23', weekNumber: 1, saved: false }} />,
    );
    expect(
      screen.getByRole('link', { name: /Your week 1 review is ready/ }).getAttribute('href'),
    ).toBe('/progress/review/2026-11-23');
    unmount();
    renderWithIntl(
      <ReviewCard review={{ weekStart: '2026-11-23', weekNumber: 1, saved: true }} />,
      'fr',
    );
    expect(screen.getByRole('link', { name: /Modifier ton bilan de la semaine 1/ })).toBeTruthy();
  });
});

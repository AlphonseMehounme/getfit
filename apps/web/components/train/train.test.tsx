// @vitest-environment jsdom
import { parseLocalDate as d } from '@getfit/domain';
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SessionAction } from '@/components/today/session-action';
import type { HistoryItem as Item } from '@/server/services/history';
import type { TodaySession, TodayView } from '@/server/services/schedule';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { HistoryItem } from './history-item';
import { HistoryList } from './history-list';
import { TodayPanel } from './today-panel';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));

const startAction = vi.fn(async () => ({ ok: true as const, sessionId: 's-1' }));
const ID = '00000000-0000-4000-8000-000000000001';

const WORKOUT: Item = {
  kind: 'workout',
  id: ID,
  startedAt: new Date('2026-11-23T07:00:00Z'),
  date: d('2026-11-23'),
  title: 'Strength A — Upper body',
  status: 'completed',
  durationS: 2400,
  setsLogged: 12,
};
const RUN: Item = {
  kind: 'run',
  id: '00000000-0000-4000-8000-000000000002',
  startedAt: new Date('2026-11-29T08:30:00Z'),
  date: d('2026-11-29'),
  distanceM: 10_840,
  durationS: 4770,
  linked: true,
};

const SESSION: TodaySession = {
  programmeDayId: 'day-1',
  title: 'Strength A — Upper body',
  sessionType: 'strength',
  bodyFocus: 'upper',
  purpose: '',
  guidance: [],
  estimatedDurationMin: 40,
  status: 'scheduled',
  start: { allowed: true, mode: 'start' },
  movedFrom: null,
  workoutSessionId: null,
  runSessionId: null,
  canLogRun: false,
  exercises: [],
};

const list = (item: Item, units: 'metric' | 'imperial' = 'metric') =>
  renderWithIntl(
    <ul>
      <HistoryItem item={item} units={units} />
    </ul>,
  );

describe('HistoryItem (PRD §9, BR-22, BR-25)', () => {
  it('a workout: title, date, status, sets and duration; opens the workout', async () => {
    const { container } = list(WORKOUT);
    expect(screen.getByText('Strength A — Upper body')).toBeTruthy();
    expect(screen.getByText('Mon, Nov 23')).toBeTruthy();
    expect(screen.getByText('Done · 12 sets · 40:00')).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe(`/train/${ID}`);
    await expectNoAxeViolations(container);
  });

  it('a workout in progress or partly done, with no duration or title', () => {
    const { unmount } = list({
      ...WORKOUT,
      status: 'in_progress',
      durationS: null,
      setsLogged: 1,
      title: null,
    });
    expect(screen.getByText('Workout')).toBeTruthy();
    expect(screen.getByText('In progress · 1 set')).toBeTruthy();
    unmount();
    list({ ...WORKOUT, status: 'partial' });
    expect(screen.getByText('Partly done · 12 sets · 40:00')).toBeTruthy();
  });

  it('a run: distance, time and pace in the user units; whether it counts', () => {
    const { unmount } = list(RUN);
    expect(screen.getByText('Run')).toBeTruthy();
    expect(
      screen.getByText('10.84 km · 1:19:30 · 7:20 /km · Counts for the programme'),
    ).toBeTruthy();
    expect(screen.getByRole('link').getAttribute('href')).toBe(`/train/run/${RUN.id}`);
    unmount();
    list({ ...RUN, linked: false }, 'imperial');
    expect(screen.getByText('6.74 mi · 1:19:30 · 11:48 /mi')).toBeTruthy();
  });
});

describe('HistoryList', () => {
  it('lists the items and links to older ones while there are more', () => {
    renderWithIntl(
      <HistoryList
        items={[RUN, WORKOUT]}
        units="metric"
        nextBefore="2026-11-23T07:00:00.000Z|x"
        emptyAction={null}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Show older' }).getAttribute('href')).toBe(
      '/train?before=2026-11-23T07%3A00%3A00.000Z%7Cx',
    );
  });

  it('BR-24: nothing logged shows the empty state with its call to action', async () => {
    const { container } = renderWithIntl(
      <HistoryList
        items={[]}
        units="metric"
        nextBefore={null}
        emptyAction={<button type="button">Log a run</button>}
      />,
    );
    expect(screen.getByText('Nothing logged yet')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Log a run' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Show older' })).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('the last page has no Show older', () => {
    renderWithIntl(
      <HistoryList items={[RUN]} units="metric" nextBefore={null} emptyAction={null} />,
    );
    expect(screen.queryByRole('link', { name: 'Show older' })).toBeNull();
  });
});

describe('TodayPanel (PRD §9)', () => {
  const day = (sessions: TodaySession[]): TodayView => ({
    kind: 'day',
    today: d('2026-11-23'),
    units: 'metric',
    programmeTitle: 'P',
    weekNumber: 1,
    durationWeeks: 8,
    weekLabel: 'Transition',
    weekFocus: '',
    week: [],
    sessions,
  });

  it('a training day shows the session and its action', () => {
    renderWithIntl(<TodayPanel today={day([SESSION])} startAction={startAction} />);
    expect(screen.getByText('Strength A — Upper body')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start workout' })).toBeTruthy();
  });

  it('a rest day says so; nothing to start', () => {
    renderWithIntl(
      <TodayPanel
        today={day([{ ...SESSION, title: 'Rest', sessionType: 'rest', status: 'rest' }])}
        startAction={startAction}
      />,
    );
    expect(screen.getByText('A rest day: nothing to start today.')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('not enrolled, before the start, and after the end', () => {
    const { unmount } = renderWithIntl(
      <TodayPanel today={{ kind: 'not_enrolled' }} startAction={startAction} />,
    );
    expect(screen.getByRole('link', { name: 'Start your programme' }).getAttribute('href')).toBe(
      '/start',
    );
    unmount();
    const before = renderWithIntl(
      <TodayPanel
        today={{
          kind: 'before_start',
          today: d('2026-11-20'),
          startDate: d('2026-11-23'),
          firstSessionTitle: 'A',
        }}
        startAction={startAction}
      />,
    );
    expect(screen.getByText('Your programme starts on Monday, November 23.')).toBeTruthy();
    before.unmount();
    renderWithIntl(
      <TodayPanel
        today={{
          kind: 'finished',
          today: d('2027-01-20'),
          endDate: d('2027-01-17'),
          durationWeeks: 8,
        }}
        startAction={startAction}
      />,
    );
    expect(screen.getByText('Nothing left to log today.')).toBeTruthy();
  });
});

describe('SessionAction (PRD §6.3, shared by Today and Train)', () => {
  const action = (session: Partial<TodaySession>) =>
    renderWithIntl(
      <SessionAction
        session={{ ...SESSION, ...session }}
        today={d('2026-11-29')}
        startAction={startAction}
      />,
    );

  it('start, resume, view a saved workout, or nothing', () => {
    const start = action({});
    expect(screen.getByRole('button', { name: 'Start workout' })).toBeTruthy();
    start.unmount();
    const resume = action({ start: { allowed: true, mode: 'resume' } });
    expect(screen.getByRole('button', { name: 'Resume workout' })).toBeTruthy();
    resume.unmount();
    const saved = action({
      status: 'partial',
      start: { allowed: false, reason: 'window_closed' },
      workoutSessionId: 'w-1',
    });
    expect(screen.getByRole('link', { name: 'View workout' }).getAttribute('href')).toBe(
      '/train/w-1',
    );
    saved.unmount();
    const completedNoId = action({
      status: 'completed',
      start: { allowed: false, reason: 'already_logged' },
    });
    expect(completedNoId.container.textContent).toBe('');
    completedNoId.unmount();
    const missed = action({ status: 'missed', start: { allowed: false, reason: 'window_closed' } });
    expect(missed.container.textContent).toBe('');
    missed.unmount();
    const rest = action({ sessionType: 'rest', status: 'rest' });
    expect(rest.container.textContent).toBe('');
  });

  it('a long run: Log run while it can be logged, then View run', () => {
    const run = { sessionType: 'run' as const, title: 'Long run' };
    const log = action({ ...run, canLogRun: true });
    expect(screen.getByRole('link', { name: 'Log run' }).getAttribute('href')).toBe(
      '/train/run/new?date=2026-11-29',
    );
    log.unmount();
    const view = action({ ...run, runSessionId: 'r-1' });
    expect(screen.getByRole('link', { name: 'View run' }).getAttribute('href')).toBe(
      '/train/run/r-1',
    );
    view.unmount();
    const closed = action({ ...run, canLogRun: false });
    expect(closed.container.textContent).toBe('');
  });
});

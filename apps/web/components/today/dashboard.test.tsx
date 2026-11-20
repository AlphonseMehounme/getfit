// @vitest-environment jsdom
import { parseLocalDate as d } from '@getfit/domain';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressRing } from '@/components/ui/progress-ring';
import type { TodayView } from '@/server/services/schedule';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { AttentionCard } from './attention-card';
import { RecentActivity } from './recent-activity';
import { ThisWeek } from './this-week';
import { TodayHeader } from './today-header';

type Day = Extract<TodayView, { kind: 'day' }>;
const DAY: Day = {
  kind: 'day',
  today: d('2026-11-24'),
  units: 'metric',
  programmeTitle: 'Strength, muscle & endurance — 8 weeks',
  weekNumber: 1,
  durationWeeks: 8,
  weekLabel: 'Transition',
  weekFocus: 'Recover and settle in.',
  week: [],
  sessions: [],
  firstName: 'Alex',
  programmeProgress: { available: true, completed: 0, partial: 0, planned: 32, ratio: 0 },
  thisWeek: {
    adherence: { available: true, completed: 0, partial: 0, planned: 4, ratio: 0 },
    runningDistanceM: 0,
  },
  recent: [],
  attention: null,
};

describe('TodayHeader (D37)', () => {
  it('greets by name, with the week and the progress ring (D63: 0% from day one)', async () => {
    const { container } = renderWithIntl(<TodayHeader view={DAY} />);
    expect(screen.getByRole('heading', { level: 1, name: 'Hello, Alex' })).toBeTruthy();
    expect(screen.getByText('Week 1 of 8 · Transition')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Programme progress: 0%' })).toBeTruthy();
    expect(screen.getByText('0 of 32 sessions')).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('without a first name, and with progress made', () => {
    renderWithIntl(
      <TodayHeader
        view={{
          ...DAY,
          firstName: null,
          programmeProgress: {
            available: true,
            completed: 7,
            partial: 2,
            planned: 32,
            ratio: 8 / 32,
          },
        }}
      />,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Hello' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Programme progress: 25%' })).toBeTruthy();
  });

  it('progress that cannot be computed shows "—"', () => {
    renderWithIntl(
      <TodayHeader
        view={{ ...DAY, programmeProgress: { available: false, reason: 'no_scheduled_sessions' } }}
      />,
    );
    expect(screen.getByRole('img', { name: 'Programme progress: —' })).toBeTruthy();
    expect(screen.queryByText(/sessions$/)).toBeNull();
  });
});

describe('ProgressRing', () => {
  it('clamps the share and keeps its label', () => {
    const { container } = renderWithIntl(
      <ProgressRing value={1.4} label="Done: 100%" text="100%" />,
    );
    expect(screen.getByRole('img', { name: 'Done: 100%' })).toBeTruthy();
    const [, bar] = container.querySelectorAll('circle');
    expect(bar!.getAttribute('stroke-dashoffset')).toBe('0');
  });
});

describe('ThisWeek (D37, D63, BR-24)', () => {
  it('real values from day one: 0 of 4, 0 km, 0%', async () => {
    const { container } = renderWithIntl(<ThisWeek thisWeek={DAY.thisWeek} units="metric" />);
    expect(screen.getByText('0 of 4')).toBeTruthy();
    expect(screen.getByText('0 km')).toBeTruthy();
    expect(screen.getByText('0%')).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('after logging: sessions with partly done, distance in miles, adherence', () => {
    renderWithIntl(
      <ThisWeek
        units="imperial"
        thisWeek={{
          adherence: { available: true, completed: 1, partial: 1, planned: 4, ratio: 0.375 },
          runningDistanceM: 10_840,
        }}
      />,
    );
    expect(screen.getByText('1 of 4')).toBeTruthy();
    expect(screen.getByText('1 partly done')).toBeTruthy();
    expect(screen.getByText('6.7 mi')).toBeTruthy();
    expect(screen.getByText('38%')).toBeTruthy();
  });

  it('a week with nothing to measure: "—" with the reason', () => {
    renderWithIntl(
      <ThisWeek
        units="metric"
        thisWeek={{
          adherence: { available: false, reason: 'no_scheduled_sessions' },
          runningDistanceM: 5000,
        }}
      />,
    );
    expect(screen.getAllByText('—')).toHaveLength(2);
    expect(screen.getByText('No training session is planned this week.')).toBeTruthy();
    expect(screen.getByText('5 km')).toBeTruthy();
  });
});

describe('RecentActivity (D37)', () => {
  it('nothing logged yet: an empty state, no zeros', () => {
    renderWithIntl(<RecentActivity items={[]} units="metric" />);
    expect(screen.getByText('Nothing logged yet')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'See all in Train' })).toBeNull();
  });

  it('the last items, and a link to all of them in Train', () => {
    renderWithIntl(
      <RecentActivity
        units="metric"
        items={[
          {
            kind: 'run',
            id: '00000000-0000-4000-8000-000000000002',
            startedAt: new Date('2026-11-24T18:00:00Z'),
            date: d('2026-11-24'),
            distanceM: 5000,
            durationS: 1800,
            linked: false,
          },
        ]}
      />,
    );
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'See all in Train' }).getAttribute('href')).toBe(
      '/train',
    );
  });
});

describe('AttentionCard (D37)', () => {
  it('names the missed day and session, and links to its options', async () => {
    const { container } = renderWithIntl(
      <AttentionCard
        attention={{
          programmeDayId: 'day-1',
          title: 'Strength A — Upper body',
          date: d('2026-11-23'),
        }}
      />,
    );
    expect(screen.getByText('Monday was missed')).toBeTruthy();
    expect(screen.getByText(/Strength A — Upper body can still be moved/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'See options' }).getAttribute('href')).toBe(
      '/programme/day/day-1',
    );
    await expectNoAxeViolations(container);
  });
});

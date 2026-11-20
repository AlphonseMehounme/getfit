// @vitest-environment jsdom
import { parseLocalDate, type Prescription } from '@getfit/domain';
import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { ProgrammeDay, WeekSession } from '@/server/services/programme-week';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { SafetyNotes } from './safety-notes';
import { SessionDetail } from './session-detail';
import { WeekDayRow } from './week-day-row';
import { WeekNav } from './week-nav';
import { WeekTimeline } from './week-timeline';

const d = parseLocalDate;
const pullUps: Prescription = {
  templateExerciseId: 'te-1',
  exerciseId: 'ex-1',
  sequence: 1,
  sets: 2,
  target: { kind: 'reps', reps: 6 },
  perSide: false,
  restS: 120,
  overridden: false,
};
const SESSION: WeekSession = {
  programmeDayId: '00000000-0000-4000-8000-000000000001',
  title: 'Strength A — Upper body',
  sessionType: 'strength',
  bodyFocus: 'upper',
  status: 'scheduled',
  plannedDate: d('2026-11-23'),
  date: d('2026-11-23'),
  movedFrom: null,
  prescriptions: [pullUps],
  exercises: [
    { slug: 'pull-up', category: 'upper', name: 'Pull-up', cues: [], prescription: pullUps },
  ],
  showsPlan: true,
  workoutSessionId: null,
  canMove: true,
  canSkip: true,
  canUndo: false,
};

describe('WeekTimeline (PRD §6.4)', () => {
  it('lists every week with its focus, marks the current one and the deload', async () => {
    const { container } = renderWithIntl(
      <WeekTimeline
        currentWeek={2}
        weeks={[
          {
            weekNumber: 1,
            label: 'Transition',
            focus: 'Recover',
            deload: false,
            longRunCeilingM: 11_000,
          },
          {
            weekNumber: 2,
            label: 'Installation',
            focus: 'Routine',
            deload: false,
            longRunCeilingM: 11_000,
          },
          { weekNumber: 5, label: 'Deload', focus: 'Lighter', deload: true, longRunCeilingM: 7000 },
        ]}
      />,
    );
    const links = screen.getAllByRole('link');
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/programme/week/1',
      '/programme/week/2',
      '/programme/week/5',
    ]);
    expect(links[1]!.getAttribute('aria-current')).toBe('true');
    expect(within(links[1]!).getByText('This week')).toBeTruthy();
    expect(within(links[2]!).getByText('Deload', { selector: '.text-warning' })).toBeTruthy();
    await expectNoAxeViolations(container);
  });
});

describe('SafetyNotes', () => {
  it('lists the notes, or nothing without any', () => {
    const { container, unmount } = renderWithIntl(
      <SafetyNotes notes={['Keep 2–3 reps in reserve.']} />,
    );
    expect(screen.getByRole('heading', { name: 'Safety notes' })).toBeTruthy();
    expect(screen.getByText('Keep 2–3 reps in reserve.')).toBeTruthy();
    unmount();
    const empty = renderWithIntl(<SafetyNotes notes={[]} />);
    expect(empty.container.textContent).toBe('');
    expect(container).toBeTruthy();
  });
});

describe('WeekNav', () => {
  it('no previous link on week 1, no next on the last', () => {
    const { unmount } = renderWithIntl(<WeekNav weekNumber={1} total={8} />);
    expect(screen.queryByRole('link', { name: 'Previous week' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Next week' }).getAttribute('href')).toBe(
      '/programme/week/2',
    );
    expect(screen.getByRole('link', { name: 'Programme overview' }).getAttribute('href')).toBe(
      '/programme',
    );
    unmount();
    renderWithIntl(<WeekNav weekNumber={8} total={8} />);
    expect(screen.getByRole('link', { name: 'Previous week' }).getAttribute('href')).toBe(
      '/programme/week/7',
    );
    expect(screen.queryByRole('link', { name: 'Next week' })).toBeNull();
  });
});

describe('WeekDayRow (PRD §6.4, D58)', () => {
  const row = (sessions: WeekSession[], isToday = false) =>
    renderWithIntl(
      <ol>
        <WeekDayRow date={d('2026-11-23')} isToday={isToday} sessions={sessions} units="metric" />
      </ol>,
    );

  it('today and later: the session, its status and its targets after deload', async () => {
    const { container } = row([SESSION], true);
    expect(screen.getByText(/Monday, November 23 · This week/)).toBeTruthy();
    expect(screen.getByRole('link', { name: SESSION.title }).getAttribute('href')).toBe(
      `/programme/day/${SESSION.programmeDayId}`,
    );
    expect(screen.getByText('Planned')).toBeTruthy();
    expect(screen.getByText('Pull-up')).toBeTruthy();
    expect(screen.getByText('2 × 6')).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('D58: a past day shows its status only, and its workout when one was logged', () => {
    const { unmount } = row([{ ...SESSION, status: 'missed', showsPlan: false }]);
    expect(screen.getByText('Missed')).toBeTruthy();
    expect(screen.queryByText('2 × 6')).toBeNull();
    expect(screen.queryByRole('link', { name: 'View workout' })).toBeNull();
    unmount();
    row([{ ...SESSION, status: 'completed', showsPlan: false, workoutSessionId: 'w-1' }]);
    expect(screen.getByText('Done')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View workout' }).getAttribute('href')).toBe(
      '/train/w-1',
    );
  });

  it('D38: a moved session says where from; a skipped one says skipped', () => {
    const { unmount } = row([{ ...SESSION, movedFrom: d('2026-11-21') }]);
    expect(screen.getByText('Moved from Saturday')).toBeTruthy();
    unmount();
    row([{ ...SESSION, status: 'skipped' }]);
    expect(screen.getByText('Skipped')).toBeTruthy();
  });

  it('a day left empty, and a session with no exercises', () => {
    const { unmount } = row([]);
    expect(screen.getByText('Nothing planned')).toBeTruthy();
    unmount();
    const { container } = row([{ ...SESSION, sessionType: 'rest', status: 'rest', exercises: [] }]);
    expect(screen.getByText('Rest')).toBeTruthy();
    // No target list for a session without exercises.
    expect(container.querySelectorAll('ul')).toHaveLength(0);
  });
});

describe('SessionDetail (PRD §6.4, D58)', () => {
  const DAY: Extract<ProgrammeDay, { kind: 'day' }> = {
    kind: 'day',
    weekNumber: 5,
    weekLabel: 'Deload',
    weekFocus: 'A lighter week to recover.',
    purpose: 'Upper-body strength, legs light after Sunday.',
    guidance: ['Keep 2–3 reps in reserve.'],
    estimatedDurationMin: 40,
    units: 'metric',
    today: d('2026-11-23'),
    session: SESSION,
  };

  it('why it exists, then the guidance and the exercises with targets', async () => {
    const { container } = renderWithIntl(<SessionDetail day={DAY} />);
    expect(screen.getByRole('heading', { level: 1, name: SESSION.title })).toBeTruthy();
    expect(screen.getByText('Strength · About 40 min')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Why this session' })).toBeTruthy();
    expect(screen.getByText('A lighter week to recover.')).toBeTruthy();
    expect(screen.getByText('Keep 2–3 reps in reserve.')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Exercises' })).toBeTruthy();
    expect(screen.getByText('2 × 6')).toBeTruthy();
    expect(screen.getByText('Rest 2 min')).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('a recovery day: optional activities, no duration, no guidance, no rest', () => {
    const walk: Prescription = {
      ...pullUps,
      sets: 1,
      target: { kind: 'duration', seconds: 1800 },
      restS: null,
    };
    renderWithIntl(
      <SessionDetail
        day={{
          ...DAY,
          estimatedDurationMin: null,
          guidance: [],
          session: {
            ...SESSION,
            sessionType: 'recovery',
            status: 'rest',
            movedFrom: d('2026-11-22'),
            exercises: [
              {
                slug: 'easy-walk',
                category: 'recovery',
                name: 'Easy walk',
                cues: [],
                prescription: walk,
              },
            ],
          },
        }}
      />,
    );
    expect(screen.getByText('Recovery')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Optional' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Guidance' })).toBeNull();
    expect(screen.getByText('Moved from Sunday')).toBeTruthy();
  });

  it('D58: a past day shows its status and workout; a day saved today says so', () => {
    const { unmount } = renderWithIntl(
      <SessionDetail
        day={{
          ...DAY,
          today: d('2026-11-24'),
          session: { ...SESSION, status: 'missed', showsPlan: false },
        }}
      />,
    );
    expect(screen.getByText('This day is past. Only what you logged is shown.')).toBeTruthy();
    expect(screen.queryByText('2 × 6')).toBeNull();
    expect(screen.queryByRole('link', { name: 'View workout' })).toBeNull();
    unmount();
    renderWithIntl(
      <SessionDetail
        day={{
          ...DAY,
          session: {
            ...SESSION,
            status: 'completed',
            showsPlan: false,
            workoutSessionId: 'w-1',
            exercises: [],
          },
        }}
      />,
    );
    expect(screen.getByText(/This session is saved/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'View workout' }).getAttribute('href')).toBe(
      '/train/w-1',
    );
  });

  it('a plan with no exercises shows no exercise list', () => {
    renderWithIntl(<SessionDetail day={{ ...DAY, session: { ...SESSION, exercises: [] } }} />);
    expect(screen.queryByRole('heading', { name: 'Exercises' })).toBeNull();
  });
});

// @vitest-environment jsdom
import type { LocalDate, SessionStatus } from '@getfit/domain';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { WeekStrip, type WeekStripDay } from './week-strip';

const DATES = [
  '2026-11-23',
  '2026-11-24',
  '2026-11-25',
  '2026-11-26',
  '2026-11-27',
  '2026-11-28',
  '2026-11-29',
];

const week = (statuses: SessionStatus[], today = 2): WeekStripDay[] =>
  DATES.map((date, i) => ({ date: date as LocalDate, status: statuses[i]!, isToday: i === today }));

const STANDARD: SessionStatus[] = [
  'completed',
  'rest',
  'scheduled',
  'rest',
  'scheduled',
  'rest',
  'scheduled',
];

describe('WeekStrip', () => {
  it('D5: lists Monday to Sunday with each day’s status by name', async () => {
    const { container } = renderWithIntl(<WeekStrip days={week(STANDARD)} />);
    const list = screen.getByRole('list', { name: 'This week' });
    const items = screen.getAllByRole('listitem');
    expect(list).toBeTruthy();
    expect(items).toHaveLength(7);
    expect(items[0]!.textContent).toContain('Monday, November 23: Done');
    expect(items[6]!.textContent).toContain('Sunday, November 29: Planned');
    await expectNoAxeViolations(container);
  });

  it('marks today, and only today, as the current date', () => {
    renderWithIntl(<WeekStrip days={week(STANDARD, 2)} />);
    const current = screen
      .getAllByRole('listitem')
      .filter((li) => li.getAttribute('aria-current') === 'date');
    expect(current).toHaveLength(1);
    expect(current[0]!.textContent).toContain('Wednesday');
  });

  it('WCAG 1.4.1: every status has its own name and icon, not just a colour', () => {
    const all: SessionStatus[] = [
      'completed',
      'partial',
      'in_progress',
      'scheduled',
      'missed',
      'skipped',
      'rest',
    ];
    renderWithIntl(<WeekStrip days={week(all)} />);
    const items = screen.getAllByRole('listitem');
    const names = items.map((li) => li.querySelector('.sr-only')!.textContent!.split(': ')[1]);
    expect(names).toEqual([
      'Done',
      'Partly done',
      'In progress',
      'Planned',
      'Missed',
      'Skipped',
      'Rest',
    ]);
    const icons = items.map((li) => li.querySelector('svg')!.getAttribute('class'));
    expect(new Set(icons).size).toBe(7);
  });

  it('AGENTS §9: green for done, amber for missed, never red', () => {
    renderWithIntl(
      <WeekStrip
        days={week(['completed', 'missed', 'not_scheduled', 'rest', 'rest', 'rest', 'rest'])}
      />,
    );
    const tone = (status: string) =>
      document.querySelector(`svg[data-status="${status}"]`)!.getAttribute('class');
    expect(tone('completed')).toContain('text-success');
    expect(tone('missed')).toContain('text-warning');
    expect(tone('not_scheduled')).toContain('text-muted');
    expect(document.body.innerHTML).not.toContain('text-danger');
  });

  it('D15: speaks French', () => {
    renderWithIntl(<WeekStrip days={week(STANDARD)} />, 'fr');
    expect(screen.getByRole('list', { name: 'Cette semaine' })).toBeTruthy();
    expect(screen.getAllByRole('listitem')[0]!.textContent).toContain(
      'lundi 23 novembre : Terminé',
    );
  });

  it('D5: refuses anything but a full week', () => {
    expect(() => renderWithIntl(<WeekStrip days={week(STANDARD).slice(0, 6)} />)).toThrow(
      RangeError,
    );
  });
});

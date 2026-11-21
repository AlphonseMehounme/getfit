'use client';

import { type DayStatus, isoWeekday, type LocalDate, mondayOf } from '@getfit/domain';
import { useFormatter, useTranslations } from 'next-intl';
import { statusStyle } from '@/components/ui/week-strip';
import { cn } from '@/lib/utils/cn';
import { type ChartEmpty, ChartFigure } from './chart-figure';

// Design-system consistency heatmap (PRD §6.8). One column per Monday–Sunday week (D5), one row per weekday. Each
// day carries its status's icon as on the week strip, never colour alone (WCAG 1.4.1). A table replaces the grid
// for screen readers (PRD §12).

export interface HeatmapDay {
  date: LocalDate;
  status: DayStatus;
}

/** Noon UTC, formatted in UTC, so the calendar date never shifts with the viewer's time zone. */
const toDate = (date: LocalDate) => new Date(`${date}T12:00:00Z`);

/** The days grouped by their week, in order. */
function byWeek(days: readonly HeatmapDay[]): { monday: LocalDate; days: HeatmapDay[] }[] {
  const weeks = new Map<LocalDate, HeatmapDay[]>();
  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const monday = mondayOf(day.date);
    weeks.set(monday, [...(weeks.get(monday) ?? []), day]);
  }
  return [...weeks.entries()].map(([monday, week]) => ({ monday, days: week }));
}

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

export function Heatmap({
  title,
  summary,
  days,
  empty,
}: {
  title: string;
  summary: string;
  days: readonly HeatmapDay[];
  empty: ChartEmpty;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const weeks = byWeek(days);
  // Day names from a known Monday (D5), in the viewer's locale.
  const weekday = (offset: number, style: 'narrow' | 'long') =>
    format.dateTime(new Date(Date.UTC(2026, 10, 23 + offset, 12)), {
      weekday: style,
      timeZone: 'UTC',
    });
  const statusAt = (week: { days: HeatmapDay[] }, offset: number) =>
    week.days.find((d) => isoWeekday(d.date) === offset + 1)?.status;
  const shown = (Object.keys(statusStyle) as DayStatus[]).filter((s) =>
    days.some((d) => d.status === s),
  );
  const weekLabel = (monday: LocalDate) =>
    t('Charts.weekOf', {
      date: format.dateTime(toDate(monday), { day: 'numeric', month: 'short', timeZone: 'UTC' }),
    });

  return (
    <ChartFigure
      title={title}
      summary={summary}
      empty={empty}
      isEmpty={days.length === 0}
      hideDrawing={false}
      table={
        <table>
          <caption>{title}</caption>
          <thead>
            <tr>
              <th scope="col">{t('Charts.week')}</th>
              {WEEKDAYS.map((offset) => (
                <th key={offset} scope="col">
                  {weekday(offset, 'long')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weeks.map((week) => (
              <tr key={week.monday}>
                <th scope="row">{weekLabel(week.monday)}</th>
                {WEEKDAYS.map((offset) => {
                  const status = statusAt(week, offset);
                  return <td key={offset}>{status ? t(`WeekStrip.status.${status}`) : ''}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      }
    >
      <div className="flex flex-col gap-3">
        {/* A long range scrolls in its own region, which the keyboard can reach (WCAG 2.1.1). */}
        <div role="region" aria-label={title} tabIndex={0} className="overflow-x-auto rounded-md">
          <div aria-hidden="true" className="grid w-max grid-flow-col grid-rows-7 gap-1">
            {WEEKDAYS.map((offset) => (
              <span key={offset} className="text-muted flex size-8 items-center text-xs">
                {weekday(offset, 'narrow')}
              </span>
            ))}
            {weeks.flatMap((week) =>
              WEEKDAYS.map((offset) => {
                const status = statusAt(week, offset);
                if (!status) return <span key={`${week.monday}-${offset}`} className="size-8" />;
                const { icon: Icon, tone } = statusStyle[status];
                return (
                  <span
                    key={`${week.monday}-${offset}`}
                    className="bg-surface flex size-8 items-center justify-center rounded-md"
                  >
                    <Icon data-status={status} className={cn('size-4', tone)} />
                  </span>
                );
              }),
            )}
          </div>
        </div>
        <ul aria-label={t('Charts.legend')} className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {shown.map((status) => {
            const { icon: Icon, tone } = statusStyle[status];
            return (
              <li key={status} className="text-muted inline-flex items-center gap-1.5">
                <Icon aria-hidden="true" className={cn('size-3.5', tone)} />
                {t(`WeekStrip.status.${status}`)}
              </li>
            );
          })}
        </ul>
      </div>
    </ChartFigure>
  );
}

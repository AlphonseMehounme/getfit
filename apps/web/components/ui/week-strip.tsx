import type { DayStatus, LocalDate } from '@getfit/domain';
import {
  Circle,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  CircleMinus,
  Minus,
  Moon,
  Play,
  SkipForward,
  type LucideIcon,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';

// PRD §6.3: Monday to Sunday (D5) with each day's status. Status is carried by an icon and its name,
// never by colour alone (WCAG 1.4.1). Green = completed, amber = attention; red is never used here (AGENTS §9).

export interface WeekStripDay {
  date: LocalDate;
  /** `none`: a day left empty, e.g. after its session moved (PRD §6.4). */
  status: DayStatus;
  isToday: boolean;
}

/** The icon and tone of each status, shared with the programme week view (one mapping). */
export const statusStyle: Record<DayStatus, { icon: LucideIcon; tone: string }> = {
  completed: { icon: CircleCheck, tone: 'text-success' },
  partial: { icon: CircleDashed, tone: 'text-success' },
  in_progress: { icon: Play, tone: 'text-accent' },
  scheduled: { icon: Circle, tone: 'text-foreground' },
  missed: { icon: CircleAlert, tone: 'text-warning' },
  skipped: { icon: SkipForward, tone: 'text-muted' },
  rest: { icon: Moon, tone: 'text-muted' },
  not_scheduled: { icon: CircleMinus, tone: 'text-muted' },
  none: { icon: Minus, tone: 'text-muted' },
};

/** Noon UTC, formatted in UTC, so the calendar date never shifts with the viewer's time zone. */
const toDate = (date: LocalDate) => new Date(`${date}T12:00:00Z`);

export function WeekStrip({ days }: { days: readonly WeekStripDay[] }) {
  const t = useTranslations('WeekStrip');
  const format = useFormatter();
  if (days.length !== 7)
    throw new RangeError('A week strip shows exactly 7 days, Monday to Sunday (D5)');

  return (
    <ol aria-label={t('label')} className="grid grid-cols-7 gap-1">
      {days.map(({ date, status, isToday }) => {
        const { icon: Icon, tone } = statusStyle[status];
        const day = toDate(date);
        const statusName = t(`status.${status}`);
        return (
          <li
            key={date}
            aria-current={isToday ? 'date' : undefined}
            className={cn(
              'rounded-control flex flex-col items-center gap-1 border px-1 py-2',
              isToday ? 'border-accent bg-surface' : 'border-transparent',
            )}
          >
            <span className="sr-only">
              {t('day', {
                date: format.dateTime(day, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  timeZone: 'UTC',
                }),
                status: statusName,
              })}
            </span>
            <span aria-hidden="true" className="text-muted text-xs uppercase">
              {format.dateTime(day, { weekday: 'short', timeZone: 'UTC' })}
            </span>
            <span aria-hidden="true" className="text-sm font-semibold tabular-nums">
              {format.dateTime(day, { day: 'numeric', timeZone: 'UTC' })}
            </span>
            <Icon aria-hidden="true" data-status={status} className={cn('size-5', tone)} />
            <span aria-hidden="true" className={cn('hidden text-xs sm:block', tone)}>
              {statusName}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

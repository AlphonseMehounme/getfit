import type { LocalDate } from '@getfit/domain';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import type { StartWorkoutAction } from '@/components/today/primary-action';
import { SessionAction } from '@/components/today/session-action';
import { START_PATH } from '@/lib/auth/paths';
import type { TodayView } from '@/server/services/schedule';

// PRD §9 Train: today's session and its one action, the same as on Today (one implementation).

/** Noon UTC, formatted in UTC, so the calendar date never shifts with the viewer's time zone. */
const toDate = (date: LocalDate) => new Date(`${date}T12:00:00Z`);

const linkClass =
  'text-accent inline-flex min-h-12 items-center font-semibold underline-offset-4 hover:underline';

export function TodayPanel({
  today,
  startAction,
}: {
  today: TodayView;
  startAction: StartWorkoutAction;
}) {
  const t = useTranslations('Train');
  const format = useFormatter();

  let body;
  if (today.kind === 'not_enrolled') {
    body = (
      <>
        <p className="text-muted">{t('notEnrolled')}</p>
        <Link href={START_PATH} className={linkClass}>
          {t('start')}
        </Link>
      </>
    );
  } else if (today.kind === 'before_start') {
    body = (
      <p className="text-muted">
        {t('beforeStart', {
          date: format.dateTime(toDate(today.startDate), {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            timeZone: 'UTC',
          }),
        })}
      </p>
    );
  } else if (today.kind === 'finished') {
    body = <p className="text-muted">{t('nothingToday')}</p>;
  } else {
    body = today.sessions.map((session) => {
      const isRest = session.sessionType === 'rest' || session.sessionType === 'recovery';
      const action = isRest ? null : (
        <SessionAction session={session} today={today.today} startAction={startAction} />
      );
      return (
        <div key={session.programmeDayId} className="flex flex-col gap-3">
          <p className="text-lg font-semibold">{session.title}</p>
          {isRest ? <p className="text-muted">{t('restDay')}</p> : action}
        </div>
      );
    });
  }

  return (
    <section aria-labelledby="train-today" className="flex flex-col gap-3">
      <h2 id="train-today" className="text-xl font-semibold">
        {t('today')}
      </h2>
      {body}
    </section>
  );
}

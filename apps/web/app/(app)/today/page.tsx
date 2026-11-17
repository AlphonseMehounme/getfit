import type { LocalDate } from '@getfit/domain';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { SessionCard } from '@/components/today/session-card';
import { Card, CardHeader } from '@/components/ui/card';
import { WeekStrip } from '@/components/ui/week-strip';
import { START_PATH } from '@/lib/auth/paths';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRequestClock } from '@/server/request-clock';
import { getToday } from '@/server/services/schedule';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Today');
  return { title: t('title') };
}

/** Noon UTC, formatted in UTC, so the calendar date never shifts with the viewer's time zone. */
const toDate = (date: LocalDate) => new Date(`${date}T12:00:00Z`);

// PRD §6.3 (Phase 1 subset): what to do today, then the week. Every value comes from getToday (AGENTS §5).
export default async function TodayPage() {
  const view = await getToday(await createSupabaseServerClient(), await getRequestClock());
  if (!view) return redirectToLogin();
  if (view.kind === 'not_enrolled') redirect(START_PATH);

  const t = await getTranslations('Today');
  const format = await getFormatter();
  const longDate = (date: LocalDate) =>
    format.dateTime(toDate(date), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    });

  if (view.kind === 'before_start') {
    return (
      <div className="flex flex-col gap-8">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <Card>
          <CardHeader title={t('beforeStart.title', { date: longDate(view.startDate) })} />
          <p className="text-muted">{t('beforeStart.body', { session: view.firstSessionTitle })}</p>
        </Card>
      </div>
    );
  }

  if (view.kind === 'finished') {
    return (
      <div className="flex flex-col gap-8">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <Card>
          <CardHeader title={t('finished.title')} />
          <p className="text-muted">{t('finished.body', { weeks: view.durationWeeks })}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-muted text-sm">{view.programmeTitle}</p>
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="font-medium">
          {t('week', { week: view.weekNumber, total: view.durationWeeks, label: view.weekLabel })}
        </p>
        <p className="text-muted text-sm">{view.weekFocus}</p>
      </header>
      {view.sessions.map((session) => (
        <SessionCard key={session.programmeDayId} session={session} units={view.units} />
      ))}
      <WeekStrip days={view.week} />
    </div>
  );
}

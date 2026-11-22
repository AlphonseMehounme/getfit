import type { LocalDate } from '@getfit/domain';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { AttentionCard } from '@/components/today/attention-card';
import { PerformanceOverview } from '@/components/today/performance-overview';
import { ReviewReadyCard } from '@/components/today/review-ready-card';
import { RecentActivity } from '@/components/today/recent-activity';
import { SessionAction } from '@/components/today/session-action';
import { ThisWeek } from '@/components/today/this-week';
import { TodayHeader } from '@/components/today/today-header';
import { SessionCard } from '@/components/today/session-card';
import { startSessionAction } from '../train/actions';
import { Card, CardHeader } from '@/components/ui/card';
import { WeekStrip } from '@/components/ui/week-strip';
import { START_PATH } from '@/lib/auth/paths';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRequestClock } from '@/server/request-clock';
import { getOverview } from '@/server/services/progress';
import { getOpenReview } from '@/server/services/review';
import { getToday } from '@/server/services/schedule';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Today');
  return { title: t('title') };
}

/** Noon UTC, formatted in UTC, so the calendar date never shifts with the viewer's time zone. */
const toDate = (date: LocalDate) => new Date(`${date}T12:00:00Z`);

// PRD §6.3 (Phase 1 subset): what to do today, then the week. Every value comes from getToday (AGENTS §5).
export default async function TodayPage() {
  const [client, clock] = [await createSupabaseServerClient(), await getRequestClock()];
  const [view, openReview, overview] = await Promise.all([
    getToday(client, clock),
    getOpenReview(client, clock),
    getOverview(client, clock),
  ]);
  if (!view || !overview) return redirectToLogin();
  // PRD §6.3: one card at most. A review already done needs no card (Progress offers to edit it).
  const reviewReady =
    openReview && !openReview.saved ? <ReviewReadyCard review={openReview} /> : null;
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
        {/* D68: week 8's review stays open until Wednesday. */}
        {reviewReady}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <TodayHeader view={view} />
      {/* PRD §6.3: one card at most; a missed session comes first (D37). */}
      {view.attention ? <AttentionCard attention={view.attention} /> : reviewReady}
      {view.sessions.map((session) => (
        <SessionCard
          key={session.programmeDayId}
          session={session}
          units={view.units}
          action={
            <SessionAction session={session} today={view.today} startAction={startSessionAction} />
          }
        />
      ))}
      <WeekStrip days={view.week} />
      <ThisWeek thisWeek={view.thisWeek} units={view.units} />
      <PerformanceOverview overview={overview} />
      <RecentActivity items={view.recent} units={view.units} />
    </div>
  );
}

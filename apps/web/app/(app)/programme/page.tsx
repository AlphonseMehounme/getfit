import { compareLocalDates, type LocalDate } from '@getfit/domain';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { SafetyNotes } from '@/components/programme/safety-notes';
import { WeekTimeline } from '@/components/programme/week-timeline';
import { START_PATH } from '@/lib/auth/paths';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { weekPath } from '@/lib/programme/paths';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRequestClock } from '@/server/request-clock';
import { getProgrammeOverview } from '@/server/services/programme-overview';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Programme');
  return { title: t('title') };
}

/** Noon UTC, formatted in UTC, so the calendar date never shifts with the viewer's time zone. */
const toDate = (date: LocalDate) => new Date(`${date}T12:00:00Z`);

const primaryLink =
  'bg-accent text-accent-foreground hover:bg-accent-hover focus-visible:outline-focus rounded-control inline-flex min-h-12 items-center justify-center px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2';

// PRD §6.4: the programme overview: description, the 8-week timeline with focus, and the safety notes.
export default async function ProgrammePage() {
  const view = await getProgrammeOverview(
    await createSupabaseServerClient(),
    await getRequestClock(),
  );
  if (!view) return redirectToLogin();
  if (view.kind === 'not_enrolled') redirect(START_PATH);
  const t = await getTranslations('Programme');
  const format = await getFormatter();
  const before = compareLocalDates(view.today, view.startDate) < 0;
  const lastWeek = view.weeks.length;

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{view.title}</h1>
        <p className="text-muted">{view.description}</p>
      </header>
      <div className="flex flex-col gap-2">
        {view.currentWeek === null ? (
          <p className="text-muted">
            {before
              ? t('startsOn', {
                  date: format.dateTime(toDate(view.startDate), {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                    timeZone: 'UTC',
                  }),
                })
              : t('finished', { weeks: lastWeek })}
          </p>
        ) : null}
        <Link href={weekPath(view.currentWeek ?? 1)} className={primaryLink}>
          {view.currentWeek === null ? t('firstWeek') : t('thisWeek')}
        </Link>
      </div>
      <section aria-labelledby="timeline" className="flex flex-col gap-3">
        <h2 id="timeline" className="text-xl font-semibold">
          {t('timeline')}
        </h2>
        <WeekTimeline weeks={view.weeks} currentWeek={view.currentWeek} />
      </section>
      <SafetyNotes notes={view.safetyNotes} />
    </div>
  );
}

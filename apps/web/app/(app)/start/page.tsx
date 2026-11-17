import type { LocalDate } from '@getfit/domain';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { type StartChoice, StartForm } from '@/components/today/start-form';
import { HOME_PATH } from '@/lib/auth/paths';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getStartOptions } from '@/server/services/enrolment';
import { getRequestClock } from '@/server/request-clock';
import { startProgrammeAction } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Start');
  return { title: t('title') };
}

/** Noon UTC, formatted in UTC, so the calendar date never shifts with the viewer's time zone. */
const toDate = (date: LocalDate) => new Date(`${date}T12:00:00Z`);

export default async function StartPage() {
  const options = await getStartOptions(
    await createSupabaseServerClient(),
    await getRequestClock(),
  );
  if (!options) return redirectToLogin();
  if (options.kind === 'enrolled') redirect(HOME_PATH);

  const t = await getTranslations('Start');
  const format = await getFormatter();
  const monday = format.dateTime(toDate(options.nextMonday), {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  });
  // BR-2: on a Monday, both choices start today.
  const choices: StartChoice[] =
    options.nextMonday === options.thisWeekMonday
      ? [{ mode: 'next_monday', label: t('today'), hint: t('todayHint') }]
      : [
          {
            mode: 'next_monday',
            label: t('nextMonday', { date: monday }),
            hint: t('nextMondayHint'),
          },
          { mode: 'this_week', label: t('thisWeek'), hint: t('thisWeekHint') },
        ];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted">{t('intro')}</p>
      </header>
      <section aria-labelledby="programme-title" className="flex flex-col gap-2">
        <h2 id="programme-title" className="text-xl font-semibold">
          {options.programmeTitle}
        </h2>
        <p className="text-muted">{options.programmeDescription}</p>
      </section>
      <StartForm choices={choices} action={startProgrammeAction} />
    </div>
  );
}

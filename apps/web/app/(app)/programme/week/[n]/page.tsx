import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { WeekDayRow } from '@/components/programme/week-day-row';
import { WeekNav } from '@/components/programme/week-nav';
import { START_PATH } from '@/lib/auth/paths';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRequestClock } from '@/server/request-clock';
import { getWeek } from '@/server/services/programme-week';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ n: string }>;
}): Promise<Metadata> {
  const t = await getTranslations('Programme');
  return { title: `${t('title')} · ${(await params).n}` };
}

// PRD §6.4: one week, Monday to Sunday (D5): each day's session, status and targets after deload (BR-17); a past
// day shows its status only (D58). Every value comes from getWeek (AGENTS §5).
export default async function ProgrammeWeekPage({ params }: { params: Promise<{ n: string }> }) {
  const week = await getWeek(
    await createSupabaseServerClient(),
    (await params).n,
    await getRequestClock(),
  );
  if (!week) return redirectToLogin();
  if (week.kind === 'not_enrolled') redirect(START_PATH);
  if (week.kind === 'out_of_range') notFound();
  const t = await getTranslations('Programme');

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          {t('weekTitle', { week: week.weekNumber, total: week.durationWeeks, label: week.label })}
        </h1>
        <p className="text-muted">{week.focus}</p>
      </header>
      <WeekNav weekNumber={week.weekNumber} total={week.durationWeeks} />
      <ol aria-label={t('days')} className="flex flex-col gap-3">
        {week.days.map((day) => (
          <WeekDayRow
            key={day.date}
            date={day.date}
            isToday={day.isToday}
            sessions={day.sessions}
            units={week.units}
          />
        ))}
      </ol>
    </div>
  );
}

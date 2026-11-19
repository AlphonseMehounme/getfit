import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { SessionDetail } from '@/components/programme/session-detail';
import { START_PATH } from '@/lib/auth/paths';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { weekPath } from '@/lib/programme/paths';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRequestClock } from '@/server/request-clock';
import { getProgrammeDay } from '@/server/services/programme-week';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Programme');
  return { title: t('why') };
}

// PRD §6.4 session detail. Every value comes from getProgrammeDay (AGENTS §5).
export default async function ProgrammeDayPage({
  params,
}: {
  params: Promise<{ programmeDayId: string }>;
}) {
  const day = await getProgrammeDay(
    await createSupabaseServerClient(),
    (await params).programmeDayId,
    await getRequestClock(),
  );
  if (!day) return redirectToLogin();
  if (day.kind === 'not_enrolled') redirect(START_PATH);
  if (day.kind === 'not_found') notFound();
  const t = await getTranslations('Programme');

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={weekPath(day.weekNumber)}
        className="text-accent inline-flex min-h-12 items-center font-semibold underline-offset-4 hover:underline"
      >
        {t('backToWeek', { week: day.weekNumber })}
      </Link>
      <SessionDetail day={day} />
    </div>
  );
}

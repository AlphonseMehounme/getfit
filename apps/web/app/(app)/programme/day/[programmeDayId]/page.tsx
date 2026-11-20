import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { SessionActions } from '@/components/programme/session-actions';
import { SessionDetail } from '@/components/programme/session-detail';
import { START_PATH } from '@/lib/auth/paths';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { weekPath } from '@/lib/programme/paths';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRequestClock } from '@/server/request-clock';
import { getMoveOptions } from '@/server/services/programme';
import { getProgrammeDay } from '@/server/services/programme-week';
import { moveSessionAction, skipSessionAction, undoOverrideAction } from '../../actions';

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
  const client = await createSupabaseServerClient();
  const clock = await getRequestClock();
  const { programmeDayId } = await params;
  const day = await getProgrammeDay(client, programmeDayId, clock);
  if (!day) return redirectToLogin();
  if (day.kind === 'not_enrolled') redirect(START_PATH);
  if (day.kind === 'not_found') notFound();
  const t = await getTranslations('Programme');
  const { session } = day;
  // BR-9 to BR-13: the candidates and their blocks come from the server with the page.
  const options = session.canMove ? await getMoveOptions(client, programmeDayId, clock) : null;
  const moveOptions = options && !('error' in options) ? options : null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href={weekPath(day.weekNumber)}
        className="text-accent inline-flex min-h-12 items-center font-semibold underline-offset-4 hover:underline"
      >
        {t('backToWeek', { week: day.weekNumber })}
      </Link>
      <SessionDetail
        day={day}
        actions={
          <SessionActions
            programmeDayId={session.programmeDayId}
            plannedDate={session.plannedDate}
            canMove={session.canMove}
            canSkip={session.canSkip}
            canUndo={session.canUndo}
            undoKind={session.status === 'skipped' ? 'skipped' : 'moved'}
            moveOptions={moveOptions}
            actions={{
              move: moveSessionAction,
              skip: skipSessionAction,
              undo: undoOverrideAction,
            }}
          />
        }
      />
    </div>
  );
}

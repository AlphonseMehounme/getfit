import { distanceUnitFor } from '@getfit/domain';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { DeleteRun } from '@/components/running/delete-run';
import { RunRecord } from '@/components/running/run-record';
import { HOME_PATH } from '@/lib/auth/paths';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { editRunPath } from '@/lib/running/paths';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRequestClock } from '@/server/request-clock';
import { getRunFormContext, getRunRecord } from '@/server/services/running';
import { deleteRunAction } from '../../runs/actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Run');
  return { title: t('record.pageTitle') };
}

// PRD §6.6: one run, with Edit and Delete. A run of another user, deleted, or never logged is not found (RLS).
export default async function RunPage({ params }: { params: Promise<{ runId: string }> }) {
  const client = await createSupabaseServerClient();
  const clock = await getRequestClock();
  const context = await getRunFormContext(client, clock);
  if (!context) return redirectToLogin();
  const { runId } = await params;
  const run = await getRunRecord(client, runId, clock);
  if (!run) notFound();

  return (
    <RunRecord
      run={run}
      unit={distanceUnitFor(context.units)}
      editHref={editRunPath(run.id)}
      deleteControl={<DeleteRun runId={run.id} deleteRun={deleteRunAction} afterPath={HOME_PATH} />}
    />
  );
}

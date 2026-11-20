import { distanceUnitFor } from '@getfit/domain';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getFormatter, getTranslations } from 'next-intl/server';
import { RunForm } from '@/components/running/run-form';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { runFormDefaults } from '@/lib/running/run-form-values';
import { runPath } from '@/lib/running/paths';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRequestClock } from '@/server/request-clock';
import { getRunFormContext, getRunRecord } from '@/server/services/running';
import { editRunAction, runLinkOptionAction } from '../../../runs/actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Run');
  return { title: t('editTitle') };
}

const actions = { save: editRunAction, linkOption: runLinkOptionAction };

// PRD §6.6: edit a run. Keeping its date keeps its link; another date asks again (D60).
export default async function EditRunPage({ params }: { params: Promise<{ runId: string }> }) {
  const client = await createSupabaseServerClient();
  const clock = await getRequestClock();
  const context = await getRunFormContext(client, clock);
  if (!context) return redirectToLogin();
  const run = await getRunRecord(client, (await params).runId, clock);
  if (!run) notFound();
  const t = await getTranslations('Run');
  const format = await getFormatter();
  const unit = distanceUnitFor(context.units);
  const keepsLink = run.countsFor
    ? {
        date: run.date,
        note: t('record.counts', {
          session: run.countsFor.title,
          day: format.dateTime(new Date(`${run.countsFor.date}T12:00:00Z`), {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            timeZone: 'UTC',
          }),
        }),
      }
    : null;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t('editTitle')}</h1>
      <RunForm
        runId={run.id}
        initial={runFormDefaults(run, { date: run.date, time: run.time }, unit)}
        unit={unit}
        keepsLink={keepsLink}
        submitLabel={t('save')}
        actions={actions}
        recordPath={runPath(run.id)}
      />
    </div>
  );
}

import { distanceUnitFor, isLocalDate } from '@getfit/domain';
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { RunForm } from '@/components/running/run-form';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { runFormDefaults } from '@/lib/running/run-form-values';
import { runPath } from '@/lib/running/paths';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRequestClock } from '@/server/request-clock';
import { getRunFormContext } from '@/server/services/running';
import { logRunAction, runLinkOptionAction } from '../../runs/actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Run');
  return { title: t('newTitle') };
}

const actions = { save: logRunAction, linkOption: runLinkOptionAction };

// PRD §6.6: log a run. `?date=` pre-fills the day (from Today or a session); otherwise it is now in the user's zone.
export default async function NewRunPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string | string[] }>;
}) {
  const context = await getRunFormContext(
    await createSupabaseServerClient(),
    await getRequestClock(),
  );
  if (!context) return redirectToLogin();
  const t = await getTranslations('Run');
  const { date } = await searchParams;
  const start = {
    date: typeof date === 'string' && isLocalDate(date) ? date : context.date,
    time: context.time,
  };
  const unit = distanceUnitFor(context.units);
  // The device would make the ID (D21); made here so the server HTML and the form agree.
  const runId = crypto.randomUUID();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t('newTitle')}</h1>
        <p className="text-muted">{t('intro')}</p>
      </header>
      <RunForm
        runId={runId}
        initial={runFormDefaults(null, start, unit)}
        unit={unit}
        keepsLink={null}
        submitLabel={t('save')}
        actions={actions}
        recordPath={runPath(runId)}
      />
    </div>
  );
}

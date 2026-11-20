import { Footprints } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { ViewWorkoutLink } from '@/components/today/view-workout-link';
import { newRunPath, runPath } from '@/lib/running/paths';

// PRD §6.3 / §6.6: a long-run day's primary action. "Log run" while the day can be logged (D14, D23), "View run"
// once a run fulfils it (D33).

export function LogRunLink({ date }: { date: string }) {
  const t = useTranslations('Today.action');
  return (
    <Link
      href={newRunPath(date)}
      className="bg-accent text-accent-foreground hover:bg-accent-hover focus-visible:outline-focus rounded-control inline-flex min-h-12 w-full items-center justify-center gap-2 px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <Footprints aria-hidden="true" className="size-5" />
      {t('logRun')}
    </Link>
  );
}

export function ViewRunLink({ runId }: { runId: string }) {
  const t = useTranslations('Today.action');
  return <ViewWorkoutLink href={runPath(runId)} label={t('viewRun')} />;
}

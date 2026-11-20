import { useFormatter, useTranslations } from 'next-intl';
import { ProgressRing } from '@/components/ui/progress-ring';
import type { TodayView } from '@/server/services/schedule';

// D37 Today header: greeting, programme, "Week n of 8 · label" and the programme progress ring (D63: a real value
// from day one). Kept short, so the primary action stays above the fold at 360 px (PRD §6.3 AC).

type Day = Extract<TodayView, { kind: 'day' }>;

export function TodayHeader({ view }: { view: Day }) {
  const t = useTranslations('Today');
  const format = useFormatter();
  const progress = view.programmeProgress;
  const percent = progress.available ? format.number(progress.ratio, { style: 'percent' }) : '—';
  return (
    <header className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-muted text-sm">{view.programmeTitle}</p>
        <h1 className="text-3xl font-semibold tracking-tight">
          {view.firstName ? t('greetingNamed', { name: view.firstName }) : t('greeting')}
        </h1>
        <p className="font-medium">
          {t('week', { week: view.weekNumber, total: view.durationWeeks, label: view.weekLabel })}
        </p>
        <p className="text-muted text-sm">{view.weekFocus}</p>
      </div>
      <div className="flex flex-col items-center gap-1">
        <ProgressRing
          value={progress.available ? progress.ratio : 0}
          text={percent}
          label={`${t('progress.label')}: ${percent}`}
        />
        {progress.available ? (
          <p className="text-muted text-xs tabular-nums">
            {t('progress.detail', { completed: progress.completed, planned: progress.planned })}
          </p>
        ) : null}
      </div>
    </header>
  );
}

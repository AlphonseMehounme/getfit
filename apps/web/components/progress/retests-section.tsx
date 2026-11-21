import { useFormatter, useTranslations } from 'next-intl';
import type { RetestsView } from '@/server/services/tests';
import { RetestForm } from './retest-form';

// D73 / PRD §7: in week 8, the re-tests and their comparison with each baseline (BR-26). Outside week 8 the results
// stay, without the form; with neither, the section isn't shown (AGENTS §9).

export function RetestsSection({
  retests,
  save,
}: {
  retests: RetestsView;
  save: (input: unknown) => Promise<{ ok: boolean }>;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const anyLogged = retests.tests.some((r) => r.latest);
  if (!retests.offered && !anyLogged) return null;

  return (
    <section aria-labelledby="progress-retests" className="flex flex-col gap-4">
      <h2 id="progress-retests" className="text-xl font-semibold">
        {t('Progress.retests.title')}
      </h2>
      <p className="text-muted">
        {retests.offered ? t('Progress.retests.intro') : t('Progress.retests.resultsIntro')}
      </p>
      {retests.offered ? <RetestForm save={save} /> : null}
      <dl aria-label={t('Progress.retests.results')} className="grid gap-3 sm:grid-cols-3">
        {retests.tests.map(({ field, baseline, latest, change }) => (
          <div key={field} className="rounded-card border-border flex flex-col gap-1 border p-3">
            <dt className="text-muted text-sm">{t(`Onboarding.baselines.${field}`)}</dt>
            <dd className="font-semibold tabular-nums">
              {!latest
                ? t('Progress.retests.notYet')
                : baseline && change !== null
                  ? t('Progress.retests.result', {
                      value: latest.value,
                      baseline: baseline.value,
                      change: format.number(change, { signDisplay: 'exceptZero' }),
                    })
                  : t('Progress.retests.resultNoBaseline', { value: latest.value })}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

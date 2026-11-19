import { formatDuration, formatPace, type UnitSystem } from '@getfit/domain';
import { useTranslations } from 'next-intl';
import {
  baselineDefaults,
  liveMetrics,
  type SavedBaselines,
  TEST_FIELDS,
  unitsFor,
} from '@/lib/onboarding/baselines-form';
import { Field } from './profile-section';

// D35 / BR-26: the baselines on Profile, in the user's units, through the same conversions and pace as step 6
// (AGENTS §5.3). A value never given is "—" (BR-24).

export function BaselinesSummary({ saved, units }: { saved: SavedBaselines; units: UnitSystem }) {
  const t = useTranslations();
  const unit = unitsFor(units);
  const shown = baselineDefaults(saved, units);
  const metrics = liveMetrics(shown, unit.distance);

  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <Field label={t('Onboarding.baselines.weight', { unit: unit.mass })}>
        {shown.weight === null ? '—' : t('Profile.number', { value: shown.weight })}
      </Field>
      {TEST_FIELDS.map((field) => (
        <Field key={field} label={t(`Onboarding.baselines.${field}`)}>
          {shown[field] ?? '—'}
        </Field>
      ))}
      <Field label={t('Onboarding.baselines.run')}>
        {saved.run && metrics
          ? t('Profile.runValue', {
              distance: shown.distance!,
              unit: unit.distance,
              time: formatDuration(saved.run.durationS),
              pace: formatPace(metrics.paceS),
            })
          : '—'}
      </Field>
    </dl>
  );
}

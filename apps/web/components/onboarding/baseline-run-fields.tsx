'use client';

import type { DistanceUnit } from '@getfit/domain';
import { useTranslations } from 'next-intl';
import type { FieldErrors, UseFormRegister } from 'react-hook-form';
import { FormField } from '@/components/ui/form-field';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { DurationFields } from '@/components/running/duration-fields';
import { PacePreview } from '@/components/running/pace-preview';
import type { BaselineValues } from '@/lib/onboarding/baselines-form';
import { liveMetrics } from '@/lib/running/run-values';
import { optionalNumber, shown } from '@/lib/onboarding/optional-number';

// Onboarding step 6's reference run (BR-26): distance, time as h / min / s, and an optional effort. Pace and speed
// are computed live from the distance and the time (BR-22, BR-23), never typed; until both are valid they show "—"
// with an explanation (BR-24).

const EFFORTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function BaselineRunFields({
  register,
  errors,
  values,
  initial,
  unit,
}: {
  register: UseFormRegister<BaselineValues>;
  errors: FieldErrors<BaselineValues>;
  /** The watched run fields, for the live pace. */
  values: Pick<BaselineValues, 'distance' | 'hours' | 'minutes' | 'seconds'>;
  /** Rendered into the server HTML, so the saved run shows before the page is interactive. */
  initial: BaselineValues;
  unit: DistanceUnit;
}) {
  const t = useTranslations('Onboarding');
  const metrics = liveMetrics(values, unit);
  const durationEmpty = values.hours === null && values.minutes === null && values.seconds === null;
  const distanceError = errors.distance
    ? values.distance === null
      ? t('errors.runIncomplete')
      : t('errors.distance')
    : undefined;
  const durationError = errors.hours
    ? durationEmpty
      ? t('errors.runIncomplete')
      : t('errors.duration')
    : undefined;

  return (
    <fieldset className="flex min-w-0 flex-col gap-4">
      <legend className="mb-1 font-semibold">{t('baselines.run')}</legend>
      <p className="text-muted -mt-2 text-sm">{t('baselines.runHint')}</p>
      <FormField
        label={t('baselines.distance', { unit })}
        type="number"
        inputMode="decimal"
        step="any"
        error={distanceError}
        defaultValue={shown(initial.distance)}
        {...register('distance', optionalNumber)}
      />
      <DurationFields
        id="baseline-duration"
        legend={t('baselines.duration')}
        register={register}
        initial={initial}
        error={durationError}
      />
      <div className="flex flex-col gap-2">
        <Label htmlFor="baseline-effort">{t('baselines.effort')}</Label>
        <Select id="baseline-effort" defaultValue={initial.effort} {...register('effort')}>
          <option value="">{t('availability.unset')}</option>
          {EFFORTS.map((effort) => (
            <option key={effort} value={String(effort)}>
              {effort}
            </option>
          ))}
        </Select>
      </div>
      <PacePreview metrics={metrics} unit={unit} />
    </fieldset>
  );
}

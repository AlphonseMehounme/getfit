'use client';

import { formatPace, type UnitSystem } from '@getfit/domain';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { FormField } from '@/components/ui/form-field';
import { Notice } from '@/components/ui/notice';
import {
  baselineDefaults,
  baselineIds,
  baselinesInput,
  type BaselineValues,
  type SavedBaselines,
  TEST_FIELDS,
  unitsFor,
} from '@/lib/onboarding/baselines-form';
import { optionalNumber, shown } from '@/lib/onboarding/optional-number';
import { liveMetrics, paceCheck, runKey } from '@/lib/running/run-values';
import { schemaResolver } from '@/lib/onboarding/schema-resolver';
import { type StepActions, useStepSubmit } from '@/lib/onboarding/use-step-submit';
import { baselinesStepSchema } from '@/lib/validation/onboarding';
import { BaselineRunFields } from './baseline-run-fields';
import { StepShell } from './step-shell';

// PRD §6.2 step 6 (BR-26): optional baselines, the reference progress is compared with, never shown as workouts.
// Values are typed in the user's units. BR-21: an unusual pace asks for a confirmation on the first submit; the next
// submit of the same run saves it. Checked with the server's schema (AGENTS §2). Leaving this step finishes
// onboarding (D54).

/** Each schema issue on the field that shows it. */
const FIELD_OF = {
  'weight.value': 'weight',
  'maxPullUps.value': 'maxPullUps',
  'maxPushUps.value': 'maxPushUps',
  'maxSquats.value': 'maxSquats',
  'run.distance': 'distance',
  'run.durationS': 'hours',
} as const satisfies Record<string, keyof BaselineValues>;

export function BaselinesStep({
  saved,
  units: system,
  actions,
}: {
  saved: SavedBaselines;
  units: UnitSystem;
  actions: StepActions;
}) {
  const t = useTranslations('Onboarding');
  const { submit, shell } = useStepSubmit('baselines', actions);
  const units = unitsFor(system);
  const [ids] = useState(() => baselineIds(saved, () => crypto.randomUUID()));
  // The run whose unusual pace was shown for confirmation (BR-21).
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  const initial = baselineDefaults(saved, system);
  const toInput = (v: BaselineValues) => baselinesInput(v, ids, system);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<BaselineValues>({
    resolver: schemaResolver(baselinesStepSchema, toInput, FIELD_OF),
    defaultValues: initial,
  });
  const [distance, hours, minutes, seconds] = useWatch({
    control,
    name: ['distance', 'hours', 'minutes', 'seconds'],
  });
  const run = { distance, hours, minutes, seconds };
  const check = paceCheck(run, units.distance);
  const confirmation = check.needsConfirmation && confirmFor === runKey(run) ? check : null;
  const metrics = liveMetrics(run, units.distance);

  const onValid = (values: BaselineValues) => {
    if (check.needsConfirmation && !confirmation) {
      setConfirmFor(runKey(values));
      return;
    }
    submit(toInput(values));
  };

  return (
    <StepShell
      {...shell}
      title={t('baselines.title')}
      intro={t('baselines.intro')}
      onSubmit={handleSubmit(onValid)}
      submitLabel={confirmation ? t('baselines.confirm.saveAnyway') : undefined}
    >
      <FormField
        label={t('baselines.weight', { unit: units.mass })}
        type="number"
        inputMode="decimal"
        step="any"
        error={errors.weight ? t('errors.weight') : undefined}
        defaultValue={shown(initial.weight)}
        {...register('weight', optionalNumber)}
      />
      <fieldset className="flex min-w-0 flex-col gap-4">
        <legend className="mb-1 font-semibold">{t('baselines.tests')}</legend>
        <p className="text-muted -mt-2 text-sm">{t('baselines.testsHint')}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {TEST_FIELDS.map((field) => (
            <FormField
              key={field}
              label={t(`baselines.${field}`)}
              type="number"
              inputMode="numeric"
              min={0}
              error={errors[field] ? t('errors.count') : undefined}
              defaultValue={shown(initial[field])}
              {...register(field, optionalNumber)}
            />
          ))}
        </div>
      </fieldset>
      <BaselineRunFields
        register={register}
        errors={errors}
        values={run}
        initial={initial}
        unit={units.distance}
      />
      {confirmation && metrics ? (
        <Notice tone="warning" title={t('baselines.pace')} live>
          {t(`baselines.confirm.${confirmation.reason}`, {
            pace: formatPace(metrics.paceS),
            unit: units.distance,
          })}
        </Notice>
      ) : null}
    </StepShell>
  );
}

'use client';

import { cmToFeetInches } from '@getfit/domain';
import { useTranslations } from 'next-intl';
import { useForm, useWatch } from 'react-hook-form';
import { FormField } from '@/components/ui/form-field';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Selector } from '@/components/ui/selector';
import { optionalNumber, shown } from '@/lib/onboarding/optional-number';
import { schemaResolver } from '@/lib/onboarding/schema-resolver';
import { type StepActions, useStepSubmit } from '@/lib/onboarding/use-step-submit';
import { profileStepSchema } from '@/lib/validation/onboarding';
import { StepShell } from './step-shell';

// PRD §6.2 step 1: first name*, birth year, height, units*, time zone* (detected at sign-up, D29). The form is
// checked with the server's own schema (AGENTS §2); height is typed in cm, or in feet and inches when imperial.

export interface ProfileAnswers {
  firstName: string | null;
  birthYear: number | null;
  heightCm: number | null;
  units: 'metric' | 'imperial';
  timezone: string;
}

interface Values {
  firstName: string;
  birthYear: number | null;
  units: 'metric' | 'imperial';
  heightCm: number | null;
  heightFt: number | null;
  heightIn: number | null;
  timezone: string;
}

/** The form's values as the step schema's input. */
function toInput(v: Values) {
  const base = {
    firstName: v.firstName,
    birthYear: v.birthYear,
    units: v.units,
    timezone: v.timezone,
  };
  if (v.units === 'metric') return { ...base, height: v.heightCm, heightUnit: 'cm' };
  if (v.heightFt === null && v.heightIn === null) return { ...base, height: null };
  return { ...base, height: (v.heightFt ?? 0) * 12 + (v.heightIn ?? 0), heightUnit: 'in' };
}

function defaults(answers: ProfileAnswers): Values {
  const imperial =
    answers.heightCm !== null && answers.units === 'imperial'
      ? cmToFeetInches(answers.heightCm)
      : null;
  return {
    firstName: answers.firstName ?? '',
    birthYear: answers.birthYear,
    units: answers.units,
    heightCm: answers.heightCm,
    heightFt: imperial?.feet ?? null,
    heightIn: imperial?.inches ?? null,
    timezone: answers.timezone,
  };
}

export function ProfileStep({
  answers,
  currentYear,
  timeZones,
  actions,
}: {
  answers: ProfileAnswers;
  currentYear: number;
  timeZones: readonly string[];
  actions: StepActions;
}) {
  const t = useTranslations('Onboarding');
  const { submit, shell } = useStepSubmit('profile', actions);
  // Also rendered into the server HTML, so the saved answers show before the page is interactive.
  const initial = defaults(answers);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<Values>({
    resolver: schemaResolver(profileStepSchema(currentYear), toInput, { height: 'heightCm' }),
    defaultValues: initial,
  });
  const imperial = useWatch({ control, name: 'units' }) === 'imperial';
  const heightError = errors.heightCm ? t('errors.height') : undefined;
  const firstNameError = errors.firstName
    ? errors.firstName.message === 'firstNameTooLong'
      ? t('errors.firstNameTooLong')
      : t('errors.firstNameRequired')
    : undefined;

  return (
    <StepShell
      {...shell}
      title={t('profile.title')}
      intro={t('profile.intro')}
      onSubmit={handleSubmit((values) => submit(toInput(values)))}
    >
      <FormField
        label={t('profile.firstName')}
        hint={t('required')}
        autoComplete="given-name"
        aria-required="true"
        error={firstNameError}
        defaultValue={initial.firstName}
        {...register('firstName')}
      />
      <FormField
        label={t('profile.birthYear')}
        type="number"
        inputMode="numeric"
        autoComplete="bday-year"
        error={errors.birthYear ? t('errors.birthYear', { year: currentYear }) : undefined}
        defaultValue={shown(initial.birthYear)}
        {...register('birthYear', optionalNumber)}
      />
      <Selector
        legend={t('profile.units')}
        type="radio"
        columns={2}
        options={[
          { value: 'metric', label: t('profile.metric'), description: t('profile.metricHint') },
          {
            value: 'imperial',
            label: t('profile.imperial'),
            description: t('profile.imperialHint'),
          },
        ]}
        defaultValues={[initial.units]}
        {...register('units')}
      />
      {imperial ? (
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label={t('profile.heightFeet')}
            type="number"
            inputMode="numeric"
            error={heightError}
            defaultValue={shown(initial.heightFt)}
            {...register('heightFt', optionalNumber)}
          />
          <FormField
            label={t('profile.heightInches')}
            type="number"
            inputMode="numeric"
            defaultValue={shown(initial.heightIn)}
            {...register('heightIn', optionalNumber)}
          />
        </div>
      ) : (
        <FormField
          label={t('profile.heightCm')}
          type="number"
          inputMode="decimal"
          error={heightError}
          defaultValue={shown(initial.heightCm)}
          {...register('heightCm', optionalNumber)}
        />
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="onboarding-timezone">{t('profile.timezone')}</Label>
        <Select
          id="onboarding-timezone"
          aria-describedby={
            errors.timezone
              ? 'onboarding-timezone-hint onboarding-timezone-error'
              : 'onboarding-timezone-hint'
          }
          aria-invalid={errors.timezone ? true : undefined}
          defaultValue={initial.timezone}
          {...register('timezone')}
        >
          {timeZones.map((zone) => (
            <option key={zone} value={zone}>
              {zone.replaceAll('_', ' ')}
            </option>
          ))}
        </Select>
        <p id="onboarding-timezone-hint" className="text-muted text-sm">
          {t('profile.timezoneHint')}
        </p>
        {errors.timezone ? (
          <p id="onboarding-timezone-error" className="text-danger text-sm">
            {t('errors.timezone')}
          </p>
        ) : null}
      </div>
    </StepShell>
  );
}

'use client';

import type { Availability, AvailabilityKind, IsoWeekday } from '@getfit/domain';
import { useFormatter, useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Selector } from '@/components/ui/selector';
import { schemaResolver } from '@/lib/onboarding/schema-resolver';
import { type StepActions, useStepSubmit } from '@/lib/onboarding/use-step-submit';
import { weekdayDate } from '@/lib/onboarding/weekday';
import { AVAILABILITY_KINDS, availabilityStepSchema } from '@/lib/validation/onboarding';
import { StepShell } from './step-shell';

// PRD §6.2 step 5 / D36: training, run and rest days, and a preferred session length. The days are pre-filled with
// the programme's; the answers are stored and never move a session. One native select per day stays compact at
// 360 px. Checked with the server's schema (AGENTS §2).

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const satisfies readonly IsoWeekday[];
const DURATIONS = [30, 45, 60, 90] as const;

type DayField = `day${IsoWeekday}`;
type Values = Record<DayField, AvailabilityKind | ''> & {
  duration: string;
  /** Only carries the step-wide error (one run day at most). */
  days?: undefined;
};

function toInput(v: Values) {
  const days: Availability = {};
  for (const day of WEEKDAYS) {
    const kind = v[`day${day}`];
    if (kind) days[day] = kind;
  }
  return { days, preferredDurationMin: v.duration ? Number(v.duration) : null };
}

export function AvailabilityStep({
  answer,
  preferredDurationMin,
  actions,
}: {
  /** The saved days, or the programme's when nothing is saved (D36). */
  answer: Availability;
  preferredDurationMin: number | null;
  actions: StepActions;
}) {
  const t = useTranslations('Onboarding');
  const format = useFormatter();
  const { submit, shell } = useStepSubmit('availability', actions);
  const initial = {
    ...(Object.fromEntries(WEEKDAYS.map((day) => [`day${day}`, answer[day] ?? ''])) as Record<
      DayField,
      AvailabilityKind | ''
    >),
    duration: preferredDurationMin === null ? '' : String(preferredDurationMin),
  };
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({
    resolver: schemaResolver(availabilityStepSchema, toInput),
    defaultValues: initial,
  });
  // A saved length outside the usual choices is still offered.
  const durations: number[] =
    preferredDurationMin === null || (DURATIONS as readonly number[]).includes(preferredDurationMin)
      ? [...DURATIONS]
      : [...DURATIONS, preferredDurationMin].sort((a, b) => a - b);

  return (
    <StepShell
      {...shell}
      title={t('availability.title')}
      intro={t('availability.intro')}
      onSubmit={handleSubmit((values) => submit(toInput(values)))}
    >
      <fieldset
        className="flex flex-col gap-3"
        aria-describedby={errors.days ? 'availability-error' : undefined}
        aria-invalid={errors.days ? true : undefined}
      >
        <legend className="mb-1 font-semibold">{t('availability.legend')}</legend>
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] items-center gap-3"
          >
            <Label htmlFor={`availability-day-${day}`}>
              {format.dateTime(weekdayDate(day), { weekday: 'long', timeZone: 'UTC' })}
            </Label>
            <Select
              id={`availability-day-${day}`}
              defaultValue={initial[`day${day}`]}
              {...register(`day${day}`)}
            >
              <option value="">{t('availability.unset')}</option>
              {AVAILABILITY_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {t(`availability.kinds.${kind}`)}
                </option>
              ))}
            </Select>
          </div>
        ))}
        {errors.days ? (
          <p id="availability-error" className="text-danger text-sm">
            {t('errors.oneRunningDay')}
          </p>
        ) : null}
      </fieldset>
      <Selector
        legend={t('availability.duration')}
        type="radio"
        columns={2}
        options={[
          { value: '', label: t('availability.durationNone') },
          ...durations.map((minutes) => ({
            value: String(minutes),
            label: t('availability.durationOption', { minutes }),
          })),
        ]}
        defaultValues={[initial.duration]}
        {...register('duration')}
      />
    </StepShell>
  );
}

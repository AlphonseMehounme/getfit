'use client';

import { useTranslations } from 'next-intl';
import type { FieldValues, Path, UseFormRegister } from 'react-hook-form';
import { FormField } from '@/components/ui/form-field';
import { optionalNumber, shown } from '@/lib/onboarding/optional-number';
import type { RunParts } from '@/lib/running/run-values';

// A run's time as h / min / s (PRD §6.6: h:mm:ss), each optional until typed. Shared by onboarding step 6 and the
// run log, with one error line for the whole time.

type DurationValues = Pick<RunParts, 'hours' | 'minutes' | 'seconds'>;

export function DurationFields<V extends FieldValues & DurationValues>({
  id,
  legend,
  register,
  initial,
  error,
}: {
  id: string;
  legend: string;
  register: UseFormRegister<V>;
  initial: DurationValues;
  /** Already translated. */
  error?: string | undefined;
}) {
  const t = useTranslations('Run');
  return (
    <fieldset
      className="flex min-w-0 flex-col gap-2"
      aria-describedby={error ? `${id}-error` : undefined}
    >
      <legend className="mb-1 text-sm font-medium">{legend}</legend>
      <div className="grid grid-cols-3 gap-3">
        {(['hours', 'minutes', 'seconds'] as const).map((part) => (
          <FormField
            key={part}
            label={t(part)}
            type="number"
            inputMode="numeric"
            min={0}
            aria-invalid={error ? true : undefined}
            defaultValue={shown(initial[part])}
            {...register(part as Path<V>, optionalNumber)}
          />
        ))}
      </div>
      {error ? (
        <p id={`${id}-error`} className="text-danger text-sm">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { FormField } from '@/components/ui/form-field';
import { optionalNumber } from '@/lib/onboarding/optional-number';
import { schemaResolver } from '@/lib/onboarding/schema-resolver';
import { RETEST_FIELDS, retestSchema } from '@/lib/validation/progress';

// D73: the week-8 re-tests, each optional, checked with the server's schema (AGENTS §2). Each save gets new IDs
// from the device (AGENTS §6), so a re-test logged again is a new one and the latest counts.

type Field = keyof typeof RETEST_FIELDS;
type Values = Record<Field, number | null>;
const FIELDS = Object.keys(RETEST_FIELDS) as Field[];
const EMPTY: Values = { maxPullUps: null, maxPushUps: null, maxSquats: null };
const newIds = () =>
  Object.fromEntries(FIELDS.map((f) => [f, crypto.randomUUID()])) as Record<Field, string>;

/** The form's values as the schema's input: an empty field is left out. */
const toInput = (ids: Record<Field, string>) => (values: Values) =>
  Object.fromEntries(
    FIELDS.flatMap((f) => (values[f] === null ? [] : [[f, { id: ids[f], value: values[f] }]])),
  );

export function RetestForm({ save }: { save: (input: unknown) => Promise<{ ok: boolean }> }) {
  const t = useTranslations();
  const [ids, setIds] = useState(newIds);
  const [status, setStatus] = useState<'idle' | 'saved' | 'failed'>('idle');
  const [pending, startTransition] = useTransition();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    // The "at least one" issue has no field; it is shown once, for the form.
    resolver: schemaResolver(retestSchema, toInput(ids), { '': 'maxPullUps' }),
    defaultValues: EMPTY,
  });
  const noneGiven = errors.maxPullUps?.message === 'oneRequired';

  const onValid = (values: Values) => {
    setStatus('idle');
    startTransition(async () => {
      const result = await save(toInput(ids)(values));
      if (!result.ok) return setStatus('failed');
      setStatus('saved');
      setIds(newIds());
      reset(EMPTY);
    });
  };

  return (
    <form noValidate onSubmit={handleSubmit(onValid)} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        {FIELDS.map((field) => (
          <FormField
            key={field}
            label={t(`Onboarding.baselines.${field}`)}
            type="number"
            inputMode="numeric"
            min={0}
            error={errors[field] && !noneGiven ? t('Progress.retests.count') : undefined}
            {...register(field, optionalNumber)}
          />
        ))}
      </div>
      {noneGiven ? <FormAlert>{t('Progress.retests.oneRequired')}</FormAlert> : null}
      {status === 'failed' ? <FormAlert>{t('Progress.retests.failed')}</FormAlert> : null}
      <p role="status" className="text-sm">
        {status === 'saved' ? t('Progress.retests.saved') : ''}
      </p>
      <Button type="submit" disabled={pending} className="self-start">
        {pending ? t('Progress.retests.saving') : t('Progress.retests.save')}
      </Button>
    </form>
  );
}

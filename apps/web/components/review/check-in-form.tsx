'use client';

import { loadForDisplay, massUnitFor, PAIN_AREAS, type UnitSystem } from '@getfit/domain';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useId, useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { FormField } from '@/components/ui/form-field';
import { Scale } from '@/components/ui/scale';
import { Select } from '@/components/ui/select';
import { Selector } from '@/components/ui/selector';
import { optionalNumber } from '@/lib/onboarding/optional-number';
import { schemaResolver } from '@/lib/onboarding/schema-resolver';
import { reviewInputSchema } from '@/lib/validation/review';
import type { ReviewRecord } from '@/server/services/review';

// PRD §6.9 / D72 check-in: four 1–5 scales, pain yes / no with where and a note, an optional weight (D67, D77) and
// notes. Checked with the server's schema (AGENTS §2); the IDs are the device's (AGENTS §6).

const SCALES = ['fatigue', 'soreness', 'sleep', 'motivation'] as const;
/** React Hook Form reads radios as strings (it ignores `setValueAs` there); unanswered is null. */
const scaleOf = (v: string | null) => (v === null || v === '' ? null : Number(v));

interface Values {
  fatigue: string | null;
  soreness: string | null;
  sleep: string | null;
  motivation: string | null;
  pain: 'yes' | 'no' | null;
  painArea: string;
  painNote: string;
  weight: number | null;
  notes: string;
}

export type SaveReview = (
  input: unknown,
) => Promise<{ ok: true } | { ok: false; error: 'closed' | 'failed' }>;

export function CheckInForm({
  weekStart,
  stored,
  units,
  save,
}: {
  weekStart: string;
  stored: ReviewRecord | null;
  units: UnitSystem;
  save: SaveReview;
}) {
  const t = useTranslations('Review');
  const router = useRouter();
  const id = useId();
  const unit = massUnitFor(units);
  const [ids] = useState(() => ({
    review: stored?.id ?? crypto.randomUUID(),
    weight: stored?.weight?.id ?? crypto.randomUUID(),
  }));
  const [status, setStatus] = useState<'idle' | 'saved' | 'closed' | 'failed'>('idle');
  const [pending, startTransition] = useTransition();
  const defaults: Values = {
    fatigue: stored?.fatigue ? String(stored.fatigue) : null,
    soreness: stored?.soreness ? String(stored.soreness) : null,
    sleep: stored?.sleep ? String(stored.sleep) : null,
    motivation: stored?.motivation ? String(stored.motivation) : null,
    pain: stored ? (stored.pain ? 'yes' : 'no') : null,
    painArea: stored?.painArea ?? '',
    painNote: stored?.painNote ?? '',
    weight: stored?.weight ? loadForDisplay(stored.weight.kg, unit) : null,
    notes: stored?.notes ?? '',
  };
  const toInput = (v: Values) => {
    const pain = v.pain === 'yes';
    return {
      id: ids.review,
      weekStart,
      fatigue: scaleOf(v.fatigue),
      soreness: scaleOf(v.soreness),
      sleep: scaleOf(v.sleep),
      motivation: scaleOf(v.motivation),
      pain,
      painArea: pain && v.painArea ? v.painArea : null,
      painNote: pain && v.painNote.trim() ? v.painNote.trim() : null,
      notes: v.notes.trim() || null,
      weight: v.weight === null ? null : { id: ids.weight, value: v.weight, unit },
    };
  };
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<Values>({
    resolver: schemaResolver(reviewInputSchema, toInput, { 'weight.value': 'weight' }),
    defaultValues: defaults,
  });
  const pain = useWatch({ control, name: 'pain' }) === 'yes';

  const onValid = (values: Values) => {
    setStatus('idle');
    startTransition(async () => {
      const result = await save(toInput(values));
      if (!result.ok) return setStatus(result.error);
      setStatus('saved');
      router.refresh();
    });
  };

  return (
    <section aria-labelledby="review-check-in" className="flex flex-col gap-4">
      <h2 id="review-check-in" className="text-xl font-semibold">
        {t('checkIn.title')}
      </h2>
      <p className="text-muted">{t('checkIn.intro')}</p>
      <form noValidate onSubmit={handleSubmit(onValid)} className="flex flex-col gap-6">
        <div className="grid gap-6 lg:grid-cols-2">
          {SCALES.map((scale) => (
            <Scale
              key={scale}
              legend={t(`checkIn.${scale}`)}
              hint={t(`checkIn.ends.${scale}`)}
              defaultValue={scaleOf(defaults[scale])}
              {...register(scale)}
            />
          ))}
        </div>
        <Selector
          legend={t('checkIn.pain')}
          type="radio"
          columns={2}
          options={[
            { value: 'no', label: t('checkIn.no') },
            { value: 'yes', label: t('checkIn.yes') },
          ]}
          defaultValues={defaults.pain ? [defaults.pain] : []}
          {...register('pain')}
        />
        {pain ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-area`} className="font-semibold">
                {t('checkIn.painArea')}
              </label>
              <Select
                id={`${id}-area`}
                aria-invalid={errors.painArea ? true : undefined}
                aria-describedby={errors.painArea ? `${id}-area-error` : undefined}
                {...register('painArea')}
              >
                <option value="">{t('checkIn.painAreaPlaceholder')}</option>
                {PAIN_AREAS.map((area) => (
                  <option key={area} value={area}>
                    {t(`areas.${area}`)}
                  </option>
                ))}
              </Select>
              {errors.painArea ? (
                <p id={`${id}-area-error`} className="text-danger text-sm">
                  {t('checkIn.errors.painArea')}
                </p>
              ) : null}
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor={`${id}-note`} className="font-semibold">
                {t('checkIn.painNote')}
              </label>
              <textarea
                id={`${id}-note`}
                maxLength={500}
                rows={2}
                className="border-control bg-background rounded-control focus-visible:outline-focus border p-3 focus-visible:outline-2"
                {...register('painNote')}
              />
            </div>
          </div>
        ) : null}
        <FormField
          label={t('checkIn.weight', { unit })}
          type="number"
          inputMode="decimal"
          step="any"
          error={errors.weight ? t('checkIn.errors.weight') : undefined}
          {...register('weight', optionalNumber)}
        />
        <div className="flex flex-col gap-2">
          <label htmlFor={`${id}-notes`} className="font-semibold">
            {t('checkIn.notes')}
          </label>
          <textarea
            id={`${id}-notes`}
            maxLength={1000}
            rows={3}
            className="border-control bg-background rounded-control focus-visible:outline-focus border p-3 focus-visible:outline-2"
            {...register('notes')}
          />
        </div>
        {status === 'closed' || status === 'failed' ? (
          <FormAlert>{t(`checkIn.errors.${status}`)}</FormAlert>
        ) : null}
        <p role="status" className="text-sm">
          {status === 'saved' ? t('checkIn.saved') : ''}
        </p>
        <Button type="submit" disabled={pending} className="self-start">
          {pending ? t('checkIn.saving') : t('checkIn.save')}
        </Button>
      </form>
    </section>
  );
}

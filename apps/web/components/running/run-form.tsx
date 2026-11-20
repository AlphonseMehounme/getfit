'use client';

import { type DistanceUnit, formatPace } from '@getfit/domain';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useTransition } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { FormField } from '@/components/ui/form-field';
import { Label } from '@/components/ui/label';
import { Notice } from '@/components/ui/notice';
import { Select } from '@/components/ui/select';
import { useHydrated } from '@/lib/hooks/use-hydrated';
import { optionalNumber, shown } from '@/lib/onboarding/optional-number';
import { schemaResolver } from '@/lib/onboarding/schema-resolver';
import { type LinkChoice, runInput, type RunFormValues } from '@/lib/running/run-form-values';
import { liveMetrics, paceCheck, runKey } from '@/lib/running/run-values';
import { logRunSchema } from '@/lib/validation/running';
import type { EditRunResult, LogRunResult, RunLinkPrompt } from '@/server/services/running';
import { DurationFields } from './duration-fields';
import { type LinkAnswer, LinkPrompt } from './link-prompt';
import { PacePreview } from './pace-preview';

// PRD §6.6 manual run entry, checked with the server's schema (AGENTS §2). Pace and speed show as the user types
// (BR-22); an unusual pace asks for a confirmation first (BR-21), never a block. The D33 question comes from the
// server for the run's date, and must be answered when there is one. The run's ID is made on the device (D21).

const EFFORTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

/** Each schema issue on the field that shows it. */
const FIELD_OF = { startedAt: 'date', durationS: 'hours' } as const;

export interface RunFormActions {
  save: (input: unknown) => Promise<LogRunResult | EditRunResult>;
  linkOption: (input: unknown) => Promise<RunLinkPrompt | { kind: 'invalid' } | null>;
}

export function RunForm({
  runId,
  initial,
  unit,
  keepsLink,
  submitLabel,
  actions,
  recordPath,
}: {
  /** The run being edited, or the new run's ID made on the device. */
  runId: string;
  initial: RunFormValues;
  unit: DistanceUnit;
  /** Edit: the run counts for the long run on this date; keeping the date keeps the link (D60). */
  keepsLink: { date: string; note: string } | null;
  submitLabel: string;
  actions: RunFormActions;
  /** Where a saved run opens. */
  recordPath: string;
}) {
  const t = useTranslations('Run');
  const router = useRouter();
  const hydrated = useHydrated();
  const [pending, startTransition] = useTransition();
  const [failure, setFailure] = useState<string | null>(null);
  // The question and its answer are kept with the date (and check) they belong to, so a new date asks afresh.
  const [fetched, setFetched] = useState<{ key: string; prompt: RunLinkPrompt } | null>(null);
  const [answered, setAnswered] = useState<{ key: string; value: LinkAnswer } | null>(null);
  const [answerError, setAnswerError] = useState(false);
  const [confirmFor, setConfirmFor] = useState<string | null>(null);
  const [checkedFor, setCheckedFor] = useState(0);

  const toInput = (v: RunFormValues) => runInput(v, runId, unit, 'none');
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RunFormValues>({
    resolver: schemaResolver(logRunSchema, toInput, FIELD_OF),
    defaultValues: initial,
  });
  const [date, distance, hours, minutes, seconds] = useWatch({
    control,
    name: ['date', 'distance', 'hours', 'minutes', 'seconds'],
  });
  const run = { distance, hours, minutes, seconds };
  const metrics = liveMetrics(run, unit);
  const check = paceCheck(run, unit);
  const confirmation = check.needsConfirmation && confirmFor === runKey(run) ? check : null;
  const linkKept = keepsLink !== null && date === keepsLink.date;
  const promptKey = `${date}|${checkedFor}`;
  const prompt = fetched?.key === promptKey ? fetched.prompt : null;
  const answer = answered?.key === promptKey ? answered.value : null;

  // D33: the question depends on the date only, so it is asked again whenever the date changes.
  useEffect(() => {
    if (linkKept || !date) return;
    let current = true;
    void actions.linkOption({ id: runId, startedAt: `${date}T12:00` }).then((result) => {
      if (!current) return;
      setFetched({
        key: promptKey,
        prompt:
          result && result.kind !== 'invalid'
            ? result
            : { kind: 'none', reason: 'no_long_run', longRun: null },
      });
    });
    return () => {
      current = false;
    };
  }, [date, linkKept, runId, actions, promptKey]);

  const asks = !linkKept && prompt !== null && prompt.kind !== 'none';
  const choice = (): LinkChoice =>
    asks && answer === 'yes' ? (prompt!.kind as 'link' | 'move_and_link') : 'none';

  const onValid = (values: RunFormValues) => {
    if (!linkKept && prompt === null) return;
    if (asks && answer === null) {
      setAnswerError(true);
      return;
    }
    if (check.needsConfirmation && !confirmation) {
      setConfirmFor(runKey(values));
      return;
    }
    setFailure(null);
    startTransition(async () => {
      const result = await actions.save(runInput(values, runId, unit, choice())).catch(() => null);
      if (result?.ok) {
        router.push(recordPath);
        router.refresh();
        return;
      }
      const error = result?.ok === false ? result.error : 'generic';
      if (error === 'future_start') setFailure(t('errors.futureStart'));
      else if (error === 'link_unavailable' || error === 'already_fulfilled') {
        setFailure(t('errors.linkUnavailable'));
        setCheckedFor((n) => n + 1);
      } else setFailure(t('errors.generic'));
    });
  };

  const durationEmpty = hours === null && minutes === null && seconds === null;
  const distanceError = errors.distance
    ? distance === null
      ? t('errors.runIncomplete')
      : t('errors.distance')
    : undefined;
  const durationError = errors.hours
    ? durationEmpty
      ? t('errors.runIncomplete')
      : t('errors.duration')
    : undefined;
  const busy = pending || !hydrated;

  return (
    <form onSubmit={handleSubmit(onValid)} noValidate className="flex flex-col gap-6">
      {failure ? <FormAlert>{failure}</FormAlert> : null}
      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-6">
        <div className="grid grid-cols-2 gap-3">
          <FormField
            label={t('date')}
            type="date"
            error={errors.date ? t('errors.start') : undefined}
            defaultValue={initial.date}
            {...register('date')}
          />
          <FormField
            label={t('startTime')}
            type="time"
            defaultValue={initial.time}
            {...register('time')}
          />
        </div>
        <FormField
          label={t('distance', { unit })}
          type="number"
          inputMode="decimal"
          step="any"
          error={distanceError}
          defaultValue={shown(initial.distance)}
          {...register('distance', optionalNumber)}
        />
        <DurationFields
          id="run-duration"
          legend={t('duration')}
          register={register}
          initial={initial}
          error={durationError}
        />
        <PacePreview metrics={metrics} unit={unit} />
        <div className="flex flex-col gap-2">
          <Label htmlFor="run-effort">{t('effort')}</Label>
          <Select
            id="run-effort"
            aria-describedby="run-effort-hint"
            defaultValue={initial.effort}
            {...register('effort')}
          >
            <option value="">{t('unset')}</option>
            {EFFORTS.map((effort) => (
              <option key={effort} value={String(effort)}>
                {effort}
              </option>
            ))}
          </Select>
          <p id="run-effort-hint" className="text-muted text-sm">
            {t('effortHint')}
          </p>
        </div>
        <FormField
          label={t('routeName')}
          error={errors.routeName ? t('errors.routeTooLong') : undefined}
          defaultValue={initial.routeName}
          {...register('routeName')}
        />
        <FormField
          label={t('notes')}
          error={errors.notes ? t('errors.notesTooLong') : undefined}
          defaultValue={initial.notes}
          {...register('notes')}
        />
        {linkKept ? (
          <p className="text-muted text-sm">{keepsLink.note}</p>
        ) : (
          <LinkPrompt
            prompt={prompt}
            onAnswer={(value) => {
              setAnswered({ key: promptKey, value });
              setAnswerError(false);
            }}
            error={answerError ? t('errors.answerRequired') : undefined}
          />
        )}
      </fieldset>
      {confirmation && metrics ? (
        <Notice tone="warning" title={t('confirm.title')} live>
          {t(`confirm.${confirmation.reason}`, { pace: formatPace(metrics.paceS), unit })}
        </Notice>
      ) : null}
      <Button type="submit" width="full" disabled={busy}>
        {pending ? t('saving') : confirmation ? t('saveAnyway') : submitLabel}
      </Button>
    </form>
  );
}

'use client';

import {
  type FinishStatus,
  formatDuration,
  type WorkoutProgress,
  type WorkoutTotals,
} from '@getfit/domain';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { cn } from '@/lib/utils/cn';

// PRD §6.5 finish: what was done, an optional effort (RPE 1–10) and notes, then save. "Save as completed" is
// offered only when every set is logged (D31), and tapping it is the user's explicit confirmation (BR-5).

export type FinishAction = (input: {
  sessionId: string;
  save: FinishStatus;
  confirm: true;
  rpe: number | null;
  notes: string | null;
}) => Promise<{ ok: boolean }>;

export interface FinishSummaryProps {
  sessionId: string;
  progress: WorkoutProgress;
  options: readonly FinishStatus[];
  totals: WorkoutTotals;
  /** D49: names of the exercises skipped in this workout, in programme order. */
  skipped?: readonly string[];
  /** Seconds spent so far, excluding pauses. */
  durationS: number;
  /** D32: a reopened partial workout starts from what it was saved with. */
  initialRpe?: number | null;
  initialNotes?: string | null;
  finish: FinishAction;
  onBack: () => void;
  onSaved: () => void;
}

const RPE_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export function FinishSummary({
  sessionId,
  progress,
  options,
  totals,
  skipped = [],
  durationS,
  initialRpe = null,
  initialNotes = null,
  finish,
  onBack,
  onSaved,
}: FinishSummaryProps) {
  const t = useTranslations('Workout.summary');
  const format = useFormatter();
  const notesId = useId();
  const [rpe, setRpe] = useState<number | null>(initialRpe);
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const missing = progress.prescribed - progress.logged;

  const save = (status: FinishStatus) =>
    startTransition(async () => {
      setFailed(false);
      try {
        const result = await finish({
          sessionId,
          save: status,
          confirm: true,
          rpe,
          notes: notes.trim() === '' ? null : notes.trim(),
        });
        if (!result.ok) throw new Error('finish refused');
        onSaved();
      } catch {
        setFailed(true);
      }
    });

  return (
    <section aria-labelledby="finish-title" className="flex flex-col gap-6">
      <h2 id="finish-title" className="text-2xl font-semibold tracking-tight">
        {t('title')}
      </h2>
      <ul className="grid grid-cols-2 gap-3">
        <li className="bg-surface rounded-control col-span-2 p-4 text-2xl font-semibold tabular-nums">
          {t('setsLogged', { logged: progress.logged, total: progress.prescribed })}
        </li>
        <li className="bg-surface rounded-control p-4 font-semibold tabular-nums">
          {t('reps', { reps: totals.reps })}
        </li>
        <li className="bg-surface rounded-control p-4 font-semibold tabular-nums">
          {t('duration', { duration: formatDuration(durationS) })}
        </li>
        {totals.holdSeconds > 0 ? (
          <li className="bg-surface rounded-control col-span-2 p-4 font-semibold tabular-nums">
            {t('hold', { seconds: totals.holdSeconds })}
          </li>
        ) : null}
        {skipped.length > 0 ? (
          <li className="bg-surface rounded-control col-span-2 p-4 font-semibold">
            {t('skipped', { names: format.list(skipped, { type: 'conjunction' }) })}
          </li>
        ) : null}
      </ul>
      <p className="font-medium">{missing === 0 ? t('complete') : t('incomplete', { missing })}</p>

      <fieldset className="flex flex-col gap-2" disabled={pending}>
        <legend className="font-semibold">{t('rpe')}</legend>
        <p className="text-muted text-sm">{t('rpeHint')}</p>
        <div className="grid grid-cols-5 gap-2">
          {RPE_VALUES.map((value) => (
            <label
              key={value}
              className={cn(
                'rounded-control border-control has-focus-visible:outline-focus flex min-h-12 cursor-pointer items-center justify-center border text-lg font-semibold tabular-nums has-focus-visible:outline-2',
                rpe === value
                  ? 'bg-accent text-accent-foreground border-accent'
                  : 'hover:bg-surface',
              )}
            >
              <input
                type="radio"
                name="rpe"
                value={value}
                checked={rpe === value}
                onChange={() => setRpe(value)}
                className="sr-only"
              />
              {value}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor={notesId} className="font-semibold">
          {t('notes')}
        </label>
        <textarea
          id={notesId}
          value={notes}
          maxLength={1000}
          rows={3}
          disabled={pending}
          onChange={(event) => setNotes(event.target.value)}
          className="border-control bg-background rounded-control focus-visible:outline-focus border p-3 focus-visible:outline-2"
        />
      </div>

      {failed ? <FormAlert>{t('error')}</FormAlert> : null}
      <div className="flex flex-col gap-3">
        {options.includes('completed') ? (
          <Button width="full" disabled={pending} onClick={() => save('completed')}>
            {pending ? t('saving') : t('saveCompleted')}
          </Button>
        ) : null}
        <Button
          width="full"
          variant={options.includes('completed') ? 'secondary' : 'primary'}
          disabled={pending}
          onClick={() => save('partial')}
        >
          {t('savePartial')}
        </Button>
        <Button width="full" variant="secondary" disabled={pending} onClick={onBack}>
          {t('back')}
        </Button>
      </div>
    </section>
  );
}

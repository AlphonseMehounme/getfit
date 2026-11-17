'use client';

import { Check, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NumberStepper } from '@/components/ui/number-stepper';

// PRD §6.5 / §9: one set, pre-filled with its target. "Done as planned" logs the target in one tap (BR-14: a set
// counts whatever was achieved); the stepper adjusts reps or seconds first. Every control is at least 48 px.

export interface SetRowProps {
  /** Already translated, e.g. "Set 2 · left". */
  label: string;
  kind: 'reps' | 'seconds';
  target: number;
  /** The value logged for this set, or null while it is open. */
  logged: number | null;
  onLog: (value: number) => void;
  /** Until the screen is interactive. */
  disabled?: boolean;
}

const MAX = { reps: 200, seconds: 3600 } as const;

export function SetRow({ label, kind, target, logged, onLog, disabled = false }: SetRowProps) {
  const t = useTranslations('Workout');
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(logged ?? target);
  const valueText = (v: number) =>
    kind === 'reps' ? t('loggedReps', { value: v }) : t('loggedSeconds', { value: v });

  if (!editing && logged !== null) {
    return (
      <div className="border-border rounded-control flex items-center justify-between gap-3 border px-4 py-2">
        <p className="flex items-center gap-2">
          <Check aria-hidden="true" className="text-success size-5" />
          <span className="sr-only">
            {t('loggedLabel', { set: label, value: valueText(logged) })}
          </span>
          <span aria-hidden="true" className="font-medium">
            {label}
          </span>
          <span aria-hidden="true" className="text-lg font-semibold tabular-nums">
            {valueText(logged)}
          </span>
        </p>
        <Button
          variant="secondary"
          disabled={disabled}
          aria-label={t('editLabel', { set: label })}
          onClick={() => {
            setValue(logged);
            setEditing(true);
          }}
        >
          <Pencil aria-hidden="true" className="size-4" />
          {t('edit')}
        </Button>
      </div>
    );
  }

  const asPlanned = value === target;
  return (
    <fieldset
      disabled={disabled}
      className="border-border rounded-control flex flex-col gap-3 border p-4"
    >
      <legend className="px-1 font-medium">{label}</legend>
      <NumberStepper
        label={t(kind === 'reps' ? 'stepperReps' : 'stepperSeconds', { set: label })}
        value={value}
        onChange={setValue}
        min={0}
        max={MAX[kind]}
        unit={t(kind === 'reps' ? 'unitReps' : 'unitSeconds')}
      />
      <Button
        width="full"
        onClick={() => {
          setEditing(false);
          onLog(value);
        }}
      >
        {asPlanned
          ? t('doneAsPlanned')
          : t(kind === 'reps' ? 'saveReps' : 'saveSeconds', { value })}
      </Button>
    </fieldset>
  );
}

'use client';

import type { MassUnit } from '@getfit/domain';
import { Check, Pencil } from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { NumberStepper } from '@/components/ui/number-stepper';
import type { SetDetails as Details } from '@/lib/hooks/use-set-logging';
import { HoldCountdown } from './hold-countdown';
import { SetDetails } from './set-details';

// PRD §6.5 / §9: one set, pre-filled with its target. "Done as planned" logs the target in one tap (BR-14: a set
// counts whatever was achieved); the stepper adjusts reps or seconds first. Every control is at least 48 px.
// A timed set has a hold countdown that pre-fills the stepper; the user still taps to log it (D46). Load and reps
// in reserve are optional and folded away (D41).

export interface SetRowProps {
  /** Already translated, e.g. "Set 2 · left". */
  label: string;
  kind: 'reps' | 'seconds';
  target: number;
  /** The value logged for this set, or null while it is open. */
  logged: number | null;
  /** D41: the load and RIR logged with it. */
  loggedDetails?: Details;
  /** D41: the user's unit for load. */
  unit?: MassUnit;
  onLog: (value: number, details: Details) => void;
  /** D46: a hold ended (at zero or stopped) with this many seconds, so the screen can announce it. */
  onHoldEnd?: (seconds: number) => void;
  /** Until the screen is interactive. */
  disabled?: boolean;
}

const MAX = { reps: 200, seconds: 3600 } as const;
const NO_DETAILS: Details = { load: null, rir: null };

export function SetRow({
  label,
  kind,
  target,
  logged,
  loggedDetails = NO_DETAILS,
  unit = 'kg',
  onLog,
  onHoldEnd,
  disabled = false,
}: SetRowProps) {
  const t = useTranslations('Workout');
  const [editing, setEditing] = useState(false);
  const format = useFormatter();
  const [value, setValue] = useState(logged ?? target);
  const [details, setDetails] = useState(loggedDetails);
  const valueText = (v: number) =>
    [
      kind === 'reps' ? t('loggedReps', { value: v }) : t('loggedSeconds', { value: v }),
      loggedDetails.load === null
        ? null
        : t('details.loadValue', { load: format.number(loggedDetails.load), unit }),
      loggedDetails.rir === null ? null : t('details.rirValue', { rir: loggedDetails.rir }),
    ]
      .filter(Boolean)
      .join(' · ');

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
            setDetails(loggedDetails);
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
      {kind === 'seconds' ? (
        <HoldCountdown
          targetS={target}
          set={label}
          disabled={disabled}
          onHeld={(seconds) => {
            setValue(seconds);
            onHoldEnd?.(seconds);
          }}
        />
      ) : null}
      <NumberStepper
        label={t(kind === 'reps' ? 'stepperReps' : 'stepperSeconds', { set: label })}
        value={value}
        onChange={setValue}
        min={0}
        max={MAX[kind]}
        unit={t(kind === 'reps' ? 'unitReps' : 'unitSeconds')}
      />
      <SetDetails set={label} unit={unit} value={details} onChange={setDetails} />
      <Button
        width="full"
        onClick={() => {
          setEditing(false);
          onLog(value, details);
        }}
      >
        {asPlanned
          ? t('doneAsPlanned')
          : t(kind === 'reps' ? 'saveReps' : 'saveSeconds', { value })}
      </Button>
    </fieldset>
  );
}

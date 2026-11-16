'use client';

import { Minus, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type KeyboardEvent, useId, useState } from 'react';
import { cn } from '@/lib/utils/cn';

// Adjusts reps, seconds or load mid-workout (PRD §6.5, §9): −/+ buttons at least 48 px (min-h-12 min-w-12),
// the value at 32 px with tabular numerals, and an editable spinbutton with arrow-key support.

interface NumberStepperProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  /** Shown after the value, e.g. "reps" or "s". */
  unit?: string;
  id?: string;
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function NumberStepper({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  id,
}: NumberStepperProps) {
  const t = useTranslations('Stepper');
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const labelId = `${inputId}-label`;
  // The text being typed; committed (clamped) on blur or Enter.
  const [draft, setDraft] = useState<string | null>(null);

  const set = (next: number) => {
    setDraft(null);
    const clamped = clamp(next, min, max);
    if (clamped !== value) onChange(clamped);
  };

  const commit = () => {
    if (draft === null) return;
    const parsed = Number.parseInt(draft, 10);
    set(Number.isNaN(parsed) ? value : parsed);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const keys: Record<string, () => number> = {
      ArrowUp: () => value + step,
      ArrowDown: () => value - step,
      PageUp: () => value + step * 10,
      PageDown: () => value - step * 10,
      Home: () => min,
      End: () => max,
    };
    if (event.key === 'Enter') return commit();
    const next = keys[event.key];
    if (!next) return;
    event.preventDefault();
    set(next());
  };

  const button =
    'rounded-control border-control hover:bg-surface focus-visible:outline-focus inline-flex min-h-12 min-w-12 items-center justify-center border focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-40';

  return (
    <div className="flex flex-col gap-2">
      <label id={labelId} htmlFor={inputId} className="text-sm font-medium">
        {label}
      </label>
      <div role="group" aria-labelledby={labelId} className="flex items-center gap-3">
        <button
          type="button"
          className={button}
          onClick={() => set(value - step)}
          disabled={value <= min}
          aria-label={t('decrease', { label })}
        >
          <Minus aria-hidden="true" className="size-5" />
        </button>
        <div className="flex items-baseline gap-1">
          <input
            id={inputId}
            role="spinbutton"
            inputMode="numeric"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
            value={draft ?? String(value)}
            onChange={(event) => setDraft(event.target.value.replace(/[^\d]/g, ''))}
            onBlur={commit}
            onKeyDown={onKeyDown}
            className={cn(
              'metric rounded-control focus-visible:outline-focus w-[3ch] bg-transparent text-center focus-visible:outline-2',
            )}
          />
          {unit ? <span className="text-muted text-sm">{unit}</span> : null}
        </div>
        <button
          type="button"
          className={button}
          onClick={() => set(value + step)}
          disabled={value >= max}
          aria-label={t('increase', { label })}
        >
          <Plus aria-hidden="true" className="size-5" />
        </button>
      </div>
    </div>
  );
}

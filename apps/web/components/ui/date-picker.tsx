import { Check, Lock } from 'lucide-react';
import { useId } from 'react';
import { cn } from '@/lib/utils/cn';

// Design-system day picker (PRD §6.4): the days a session can move to, as radio rows in a fieldset. A day the rules
// refuse is disabled, and its reasons are read with it (aria-describedby), so the user knows why (BR-9 to BR-13).
// Rows are ≥ 48 px. Every choice and every reason comes from the server; the picker decides nothing.

export interface DayOption {
  /** YYYY-MM-DD. */
  value: string;
  /** Already formatted, e.g. "Thursday, November 26". */
  label: string;
  allowed: boolean;
  /** Already translated, one per broken rule. */
  reasons: readonly string[];
}

export function DatePicker({
  legend,
  options,
  value,
  onChange,
  allowedLabel,
}: {
  legend: string;
  options: readonly DayOption[];
  value: string | null;
  onChange: (value: string) => void;
  /** Already translated, shown on a day that can be chosen. */
  allowedLabel: string;
}) {
  const id = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 font-semibold">{legend}</legend>
      {options.map((option) => {
        const labelId = `${id}-${option.value}-label`;
        const reasonsId = `${id}-${option.value}-reasons`;
        return (
          <label
            key={option.value}
            className={cn(
              'rounded-control flex min-h-12 items-start gap-3 border px-4 py-3',
              option.allowed
                ? 'border-control has-checked:border-accent has-checked:bg-surface hover:bg-surface cursor-pointer has-checked:border-2'
                : 'border-border cursor-not-allowed',
              'has-focus-visible:outline-focus has-focus-visible:outline-2 has-focus-visible:outline-offset-2',
            )}
          >
            <input
              type="radio"
              name={id}
              value={option.value}
              checked={value === option.value}
              disabled={!option.allowed}
              onChange={() => onChange(option.value)}
              aria-labelledby={labelId}
              aria-describedby={reasonsId}
              className="sr-only"
            />
            {option.allowed ? (
              <Check
                aria-hidden="true"
                className={cn(
                  'text-accent mt-0.5 size-5 shrink-0',
                  value === option.value ? 'opacity-100' : 'opacity-0',
                )}
              />
            ) : (
              <Lock aria-hidden="true" className="text-muted mt-0.5 size-5 shrink-0" />
            )}
            <span className="flex flex-col gap-1">
              <span id={labelId} className={cn('font-medium', !option.allowed && 'text-muted')}>
                {option.label}
              </span>
              <span id={reasonsId} className="text-muted flex flex-col text-sm">
                {option.allowed
                  ? allowedLabel
                  : option.reasons.map((reason) => <span key={reason}>{reason}</span>)}
              </span>
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

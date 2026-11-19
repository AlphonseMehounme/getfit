import { Check } from 'lucide-react';
import { type ComponentProps, useId } from 'react';
import { cn } from '@/lib/utils/cn';

// Design-system selector (PRD §9): one choice (radio) or several (checkbox), as chips. Native inputs inside labels,
// in a fieldset with a legend, so the keyboard and screen readers work as for any form control (WCAG 2.2 AA). The
// checked state shows as the accent border and a check icon, never by colour alone. Each option is ≥ 48 px.

export interface SelectorOption {
  value: string;
  /** Already translated. */
  label: string;
  description?: string;
}

type InputProps = Omit<ComponentProps<'input'>, 'type' | 'value' | 'children'>;

interface SelectorProps extends InputProps {
  legend: string;
  type: 'radio' | 'checkbox';
  options: readonly SelectorOption[];
  hint?: string | undefined;
  /** Already translated. */
  error?: string | undefined;
  /** Two columns from the small breakpoint, for short labels. */
  columns?: 1 | 2;
  /** Checked in the server-rendered HTML, before a form library takes over. */
  defaultValues?: readonly string[];
}

export function Selector({
  legend,
  type,
  options,
  hint,
  error,
  columns = 1,
  defaultValues = [],
  className,
  ...inputProps
}: SelectorProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <fieldset
      className={cn('flex flex-col gap-3', className)}
      aria-describedby={describedBy || undefined}
      aria-invalid={error ? true : undefined}
    >
      <legend className="mb-1 font-semibold">{legend}</legend>
      {hint ? (
        <p id={hintId} className="text-muted -mt-1 text-sm">
          {hint}
        </p>
      ) : null}
      <div className={cn('grid gap-3', columns === 2 && 'sm:grid-cols-2')}>
        {options.map((option) => (
          <label
            key={option.value}
            className={cn(
              'group border-control rounded-control flex min-h-12 cursor-pointer items-center gap-3 border px-4 py-3',
              'hover:bg-surface has-checked:border-accent has-checked:bg-surface has-checked:border-2',
              'has-focus-visible:outline-focus has-focus-visible:outline-2 has-focus-visible:outline-offset-2',
            )}
          >
            <input
              type={type}
              value={option.value}
              defaultChecked={defaultValues.includes(option.value)}
              className="sr-only"
              aria-labelledby={`${id}-${option.value}`}
              aria-describedby={option.description ? `${id}-${option.value}-hint` : undefined}
              {...inputProps}
            />
            <span className="flex flex-1 flex-col">
              <span id={`${id}-${option.value}`} className="font-medium">
                {option.label}
              </span>
              {option.description ? (
                <span id={`${id}-${option.value}-hint`} className="text-muted text-sm">
                  {option.description}
                </span>
              ) : null}
            </span>
            <Check
              aria-hidden="true"
              className="text-accent size-5 opacity-0 group-has-checked:opacity-100"
            />
          </label>
        ))}
      </div>
      {error ? (
        <p id={errorId} className="text-danger text-sm">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

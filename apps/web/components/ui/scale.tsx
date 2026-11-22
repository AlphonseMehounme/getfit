import { type ComponentProps, useId } from 'react';
import { cn } from '@/lib/utils/cn';

// Design-system 1–5 scale (PRD §9, §6.9 check-in): native radios in a fieldset with a legend and the ends' meaning,
// so the keyboard and screen readers work as for any form control. The checked value shows as a thicker accent
// border and a bold number, never by colour alone. Five ≥ 48 px chips fit one row at 360 px.

const VALUES = [1, 2, 3, 4, 5] as const;

type InputProps = Omit<ComponentProps<'input'>, 'type' | 'value' | 'children' | 'defaultValue'>;

export function Scale({
  legend,
  hint,
  defaultValue = null,
  ...inputProps
}: InputProps & {
  legend: string;
  /** The ends' meaning, e.g. "1 = none · 5 = extreme". */
  hint: string;
  defaultValue?: number | null;
}) {
  const id = useId();
  return (
    <fieldset className="flex flex-col gap-2" aria-describedby={`${id}-hint`}>
      <legend className="mb-1 font-semibold">{legend}</legend>
      <p id={`${id}-hint`} className="text-muted -mt-1 text-sm">
        {hint}
      </p>
      <div className="grid grid-cols-5 gap-2">
        {VALUES.map((value) => (
          <label
            key={value}
            className={cn(
              'border-control rounded-control flex min-h-12 cursor-pointer items-center justify-center border text-lg tabular-nums',
              'hover:bg-surface has-checked:border-accent has-checked:bg-surface has-checked:border-2 has-checked:font-bold',
              'has-focus-visible:outline-focus has-focus-visible:outline-2 has-focus-visible:outline-offset-2',
            )}
          >
            <input
              type="radio"
              value={value}
              defaultChecked={defaultValue === value}
              className="sr-only"
              {...inputProps}
            />
            {value}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

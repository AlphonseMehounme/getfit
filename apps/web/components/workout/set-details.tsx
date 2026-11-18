'use client';

import type { MassUnit } from '@getfit/domain';
import { ChevronDown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils/cn';
import type { SetDetails as Details } from '@/lib/hooks/use-set-logging';

// D41: optional load (in the user's unit) and reps in reserve on a set. Neither changes whether the set counts
// (BR-14), so they stay folded away until the user asks for them; an empty field means "not recorded".

const RIR_VALUES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;

export interface SetDetailsProps {
  /** The set's label, e.g. "Set 2 · left". */
  set: string;
  unit: MassUnit;
  value: Details;
  onChange: (value: Details) => void;
}

export function SetDetails({ set, unit, value, onChange }: SetDetailsProps) {
  const t = useTranslations('Workout.details');
  const id = useId();
  const [open, setOpen] = useState(value.load !== null || value.rir !== null);

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={`${id}-panel`}
        onClick={() => setOpen(!open)}
        className="rounded-control focus-visible:outline-focus hover:bg-surface -mx-2 inline-flex min-h-12 items-center gap-2 self-start px-2 text-sm font-semibold focus-visible:outline-2"
      >
        <ChevronDown
          aria-hidden="true"
          className={cn(
            'duration-fast size-4 transition-transform motion-reduce:transition-none',
            open && 'rotate-180',
          )}
        />
        {t('toggle')} <span className="sr-only">{t('forSet', { set })}</span>
      </button>
      {open ? (
        <div id={`${id}-panel`} className="grid grid-cols-2 gap-3">
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-load`}>{t('load', { unit })}</Label>
            <Input
              id={`${id}-load`}
              type="number"
              inputMode="decimal"
              min={0}
              max={2000}
              step={0.5}
              value={value.load ?? ''}
              onChange={(event) => {
                const raw = event.target.value;
                const load = Number(raw);
                onChange({
                  ...value,
                  load: raw === '' || !Number.isFinite(load) || load < 0 ? null : load,
                });
              }}
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor={`${id}-rir`}>{t('rir')}</Label>
            <select
              id={`${id}-rir`}
              value={value.rir ?? ''}
              onChange={(event) =>
                onChange({
                  ...value,
                  rir: event.target.value === '' ? null : Number(event.target.value),
                })
              }
              className="border-control bg-background text-foreground rounded-control focus-visible:outline-focus min-h-12 w-full border px-4 text-base focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <option value="">{t('rirNone')}</option>
              {RIR_VALUES.map((rir) => (
                <option key={rir} value={rir}>
                  {rir}
                </option>
              ))}
            </select>
          </div>
        </div>
      ) : null}
    </div>
  );
}

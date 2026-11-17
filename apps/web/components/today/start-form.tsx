'use client';

import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';

// D20 / BR-2: the Phase 1 "Start programme" step. Each choice is a submit button carrying its mode, so the form
// also works before JavaScript loads. The server action validates the mode again (AGENTS §12).

export type StartMode = 'next_monday' | 'this_week';

export interface StartChoice {
  mode: StartMode;
  /** Already translated, e.g. "Start on Monday 23 November". */
  label: string;
  hint: string;
}

export type StartFormState = { error: true } | null;

export function StartForm({
  choices,
  action,
}: {
  choices: readonly StartChoice[];
  action: (state: StartFormState, formData: FormData) => Promise<StartFormState>;
}) {
  const t = useTranslations('Start');
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      {state?.error ? <FormAlert>{t('error')}</FormAlert> : null}
      <fieldset className="flex flex-col gap-6" disabled={pending}>
        <legend className="mb-4 text-xl font-semibold">{t('options')}</legend>
        {choices.map((choice, index) => (
          <div key={choice.mode} className="flex flex-col gap-2">
            <Button
              type="submit"
              name="mode"
              value={choice.mode}
              width="full"
              variant={index === 0 ? 'primary' : 'secondary'}
              aria-describedby={`start-${choice.mode}-hint`}
            >
              {pending ? t('pending') : choice.label}
            </Button>
            <p id={`start-${choice.mode}-hint`} className="text-muted text-sm">
              {choice.hint}
            </p>
          </div>
        ))}
      </fieldset>
    </form>
  );
}

'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { FormEventHandler, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { useHydrated } from '@/lib/hooks/use-hydrated';

// PRD §6.2: one short step per screen, with progress shown. Steps 2–6 can be skipped: Skip moves on without saving
// (on the last step it finishes onboarding, D54). Back never loses what was saved. The controls stay disabled until
// the page is interactive, so a tap before hydration can never submit the form natively (answers in the URL).

interface StepShellProps {
  current: number;
  total: number;
  title: string;
  intro: string;
  onSubmit: FormEventHandler<HTMLFormElement>;
  pending: boolean;
  failed: boolean;
  isLast: boolean;
  backHref: string | null;
  /** A link to the next step, or a function that finishes onboarding; absent on step 1. */
  skip?: string | (() => void) | undefined;
  /** Replaces Next / Finish, e.g. "Save anyway" after a confirmation is asked (BR-21). */
  submitLabel?: string | undefined;
  children: ReactNode;
}

const linkClass =
  'border-control hover:bg-surface focus-visible:outline-focus rounded-control inline-flex min-h-12 items-center justify-center border px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2';

export function StepShell({
  current,
  total,
  title,
  intro,
  onSubmit,
  pending,
  failed,
  isLast,
  backHref,
  skip,
  submitLabel,
  children,
}: StepShellProps) {
  const t = useTranslations('Onboarding');
  const hydrated = useHydrated();
  const busy = pending || !hydrated;
  const progress = t('progress', { current, total });

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
      <header className="flex flex-col gap-3">
        <p id="onboarding-progress" className="text-muted text-sm font-medium">
          {progress}
        </p>
        <progress
          aria-labelledby="onboarding-progress"
          value={current}
          max={total}
          className="accent-accent h-2 w-full"
        />
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted">{intro}</p>
      </header>
      {failed ? <FormAlert>{t('error')}</FormAlert> : null}
      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-6">
        {children}
      </fieldset>
      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <Button type="submit" disabled={busy} className="sm:flex-1">
          {pending ? t('pending') : (submitLabel ?? (isLast ? t('finish') : t('next')))}
        </Button>
        {typeof skip === 'string' ? (
          <Link href={skip} className={linkClass}>
            {t('skip')}
          </Link>
        ) : skip ? (
          <Button variant="secondary" disabled={busy} onClick={skip}>
            {t('skip')}
          </Button>
        ) : null}
        {backHref ? (
          <Link href={backHref} className={linkClass}>
            {t('back')}
          </Link>
        ) : null}
      </div>
    </form>
  );
}

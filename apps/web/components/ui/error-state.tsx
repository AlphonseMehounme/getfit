'use client';

import { CircleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from './button';

interface ErrorStateProps {
  /** `reset` from an `error.tsx` boundary. */
  onRetry: () => void;
  headingLevel?: 1 | 2;
}

/**
 * PRD §12: user-facing errors are generic; details go to monitoring, never to the screen.
 * Red is reserved for errors (AGENTS §9).
 */
export function ErrorState({ onRetry, headingLevel = 1 }: ErrorStateProps) {
  const t = useTranslations('States');
  const Heading = headingLevel === 1 ? 'h1' : 'h2';
  return (
    <div role="alert" className="flex flex-col items-start gap-3">
      <CircleAlert aria-hidden="true" className="text-danger size-8" />
      <Heading className="text-2xl font-semibold tracking-tight">{t('errorTitle')}</Heading>
      <p className="text-muted">{t('errorBody')}</p>
      <Button onClick={onRetry}>{t('retry')}</Button>
    </div>
  );
}

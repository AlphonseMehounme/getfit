'use client';

import { distanceUnitFor, metresTo, roundTo, type UnitSystem } from '@getfit/domain';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import type { ReviewView } from '@/server/services/review';

// BR-19 / D79 / D80: the week's suggested progression, accepted or declined once. Nothing changes unless it is
// accepted (BR-18); an accepted change applies from the next week, and pain reported afterwards withdraws it.

export type DecideSuggestion = (
  decision: 'accepted' | 'declined',
) => Promise<{ ok: true } | { ok: false; error: 'closed' | 'failed' }>;

export function SuggestionCard({
  suggestion,
  decision,
  open,
  units,
  decide,
}: {
  suggestion: NonNullable<ReviewView['suggestion']>;
  decision: ReviewView['decision'];
  /** D68: the review can still be answered. */
  open: boolean;
  units: UnitSystem;
  decide: DecideSuggestion;
}) {
  const t = useTranslations('Review.suggestion');
  const router = useRouter();
  const [error, setError] = useState<'closed' | 'failed' | null>(null);
  const [pending, startTransition] = useTransition();
  const unit = distanceUnitFor(units);
  const km = (m: number) => roundTo(metresTo(m, unit), 1);
  const week = suggestion.fromWeek;
  const text =
    suggestion.kind === 'long_run'
      ? t('longRun', { from: km(suggestion.fromM), to: km(suggestion.toM), unit, week })
      : t(suggestion.perSide ? 'repsPerSide' : 'reps', {
          exercise: suggestion.exercise,
          session: suggestion.session,
          sets: suggestion.sets,
          from: suggestion.fromReps,
          to: suggestion.toReps,
          week,
        });

  const answer = (choice: 'accepted' | 'declined') => {
    setError(null);
    startTransition(async () => {
      const result = await decide(choice);
      if (!result.ok) return setError(result.error);
      router.refresh();
    });
  };

  return (
    <section
      aria-labelledby="review-suggestion"
      className="rounded-card border-border flex flex-col gap-3 border p-4"
    >
      <h2 id="review-suggestion" className="font-semibold">
        {t('title')}
      </h2>
      <p>{text}</p>
      {decision ? (
        <p className="font-medium">
          {decision === 'accepted' ? t('accepted', { week }) : t(decision)}
        </p>
      ) : open ? (
        <>
          <p className="text-muted text-sm">{t('note')}</p>
          {error ? <FormAlert>{t(`errors.${error}`)}</FormAlert> : null}
          <div className="flex flex-wrap gap-3">
            <Button disabled={pending} onClick={() => answer('accepted')}>
              {pending ? t('saving') : t('accept')}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => answer('declined')}>
              {t('decline')}
            </Button>
          </div>
        </>
      ) : (
        <p className="text-muted">{t('unanswered')}</p>
      )}
    </section>
  );
}

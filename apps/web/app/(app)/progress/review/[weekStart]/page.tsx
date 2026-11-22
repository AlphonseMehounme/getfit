import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ActionLink } from '@/components/progress/action-link';
import { CheckInForm } from '@/components/review/check-in-form';
import { CheckedIn } from '@/components/review/checked-in';
import { Insights } from '@/components/review/insights';
import { PainMessage } from '@/components/review/pain-message';
import { Recommendation } from '@/components/review/recommendation';
import { ReviewSummary } from '@/components/review/review-summary';
import { SuggestionCard } from '@/components/review/suggestion-card';
import { EmptyState } from '@/components/ui/empty-state';
import { PROGRESS_PATH, START_PATH } from '@/lib/auth/paths';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRequestClock } from '@/server/request-clock';
import { getReview } from '@/server/services/review';
import { decideSuggestionAction, saveReviewAction } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Review');
  return { title: t('heading') };
}

// PRD §6.9 weekly review: the summary first, then the check-in, then the insights and the one recommendation (D64).
// Open from Sunday 18:00 until Wednesday (D68); a closed review is read-only. Pain leads to the cautious message and
// never to a progression (BR-27).
export default async function ReviewPage({ params }: { params: Promise<{ weekStart: string }> }) {
  const { weekStart } = await params;
  const view = await getReview(
    await createSupabaseServerClient(),
    weekStart,
    await getRequestClock(),
  );
  if (!view) return redirectToLogin();
  const t = await getTranslations('Review');
  if (view.kind === 'not_enrolled') {
    // WCAG 2.4.6 / axe: the page keeps its level-one heading.
    return (
      <div className="flex flex-col gap-8">
        <h1 className="text-3xl font-semibold tracking-tight">{t('heading')}</h1>
        <EmptyState
          title={t('notEnrolled.title')}
          description={t('notEnrolled.description')}
          action={<ActionLink href={START_PATH}>{t('notEnrolled.action')}</ActionLink>}
        />
      </div>
    );
  }
  if (view.kind === 'not_a_week') notFound();

  const { stored, state } = view;
  const back = <ActionLink href={PROGRESS_PATH}>{t('back')}</ActionLink>;
  const results = stored ? (
    <>
      {stored.pain ? <PainMessage area={stored.painArea} /> : null}
      <Recommendation recommendation={view.recommendation} />
      {view.suggestion ? (
        <SuggestionCard
          suggestion={view.suggestion}
          decision={view.decision}
          open={state === 'open'}
          units={view.units}
          decide={decideSuggestionAction.bind(null, view.weekStart)}
        />
      ) : null}
      <Insights insights={view.insights} />
    </>
  ) : null;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-3xl font-semibold tracking-tight">
        {t('title', { week: view.weekNumber })}
      </h1>
      {state === 'not_yet' ? (
        <>
          <p className="text-muted">{t('notYet')}</p>
          <div>{back}</div>
        </>
      ) : (
        <>
          <ReviewSummary summary={view.summary} units={view.units} />
          {state === 'open' ? (
            <CheckInForm
              weekStart={view.weekStart}
              stored={stored}
              units={view.units}
              save={saveReviewAction}
            />
          ) : stored ? (
            <CheckedIn review={stored} />
          ) : (
            <p className="text-muted">{t('closed')}</p>
          )}
          {results}
          <div>{back}</div>
        </>
      )}
    </div>
  );
}

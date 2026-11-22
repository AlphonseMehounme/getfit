import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ConsistencySection } from '@/components/progress/consistency-section';
import { NoRange } from '@/components/progress/no-range';
import { RangeFilter } from '@/components/progress/range-filter';
import { ReviewCard } from '@/components/progress/review-card';
import { RetestsSection } from '@/components/progress/retests-section';
import { RunningSection } from '@/components/progress/running-section';
import { StrengthSection } from '@/components/progress/strength-section';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getRequestClock } from '@/server/request-clock';
import { getProgress } from '@/server/services/progress';
import { getOpenReview } from '@/server/services/review';
import { getRetests } from '@/server/services/tests';
import { saveRetestsAction } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Progress');
  return { title: t('title') };
}

// PRD §6.8 Progress: strength, running and consistency over one range (D74). Every value comes from getProgress.
export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string | string[] }>;
}) {
  const { range } = await searchParams;
  const [client, clock] = [await createSupabaseServerClient(), await getRequestClock()];
  const [view, retests, openReview] = await Promise.all([
    getProgress(client, { range: typeof range === 'string' ? range : undefined }, clock),
    getRetests(client, clock),
    getOpenReview(client, clock),
  ]);
  if (!view || !retests) return redirectToLogin();
  const t = await getTranslations('Progress');

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted">{t('intro')}</p>
      </header>
      {openReview ? <ReviewCard review={openReview} /> : null}
      {/* D73: in week 8 the re-tests come first; they aren't tied to the range. */}
      <RetestsSection retests={retests} save={saveRetestsAction} />
      <RangeFilter current={view.range} />
      {view.kind === 'no_range' ? (
        <NoRange range={view.range === 'programme' ? 'programme' : 'other'} />
      ) : (
        <>
          <StrengthSection view={view} />
          <RunningSection view={view} />
          <ConsistencySection view={view} />
        </>
      )}
    </div>
  );
}

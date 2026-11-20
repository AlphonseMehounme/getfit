import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ExerciseResult } from '@/components/library/exercise-result';
import { LibraryFilters } from '@/components/library/library-filters';
import { EmptyState } from '@/components/ui/empty-state';
import { LIBRARY_PATH } from '@/lib/auth/paths';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getLibrary } from '@/server/services/library';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Library');
  return { title: t('title') };
}

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

// PRD §6.7: the searchable exercise library. The search runs on the server from the address (the domain's rule).
export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const view = await getLibrary(await createSupabaseServerClient(), {
    query: first(params.query),
    category: first(params.category),
    equipment: first(params.equipment),
    muscle: first(params.muscle),
    difficulty: first(params.difficulty),
  });
  if (!view) return redirectToLogin();
  const t = await getTranslations('Library');

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-muted">{t('intro')}</p>
      </header>
      <LibraryFilters filters={view.filters} options={view.options} />
      <p role="status" className="text-muted text-sm">
        {t('results', { count: view.results.length })}
      </p>
      {view.results.length === 0 ? (
        <EmptyState
          title={t('noResults.title')}
          description={t('noResults.body')}
          action={
            <Link
              href={LIBRARY_PATH}
              className="text-accent font-semibold underline-offset-4 hover:underline"
            >
              {t('clear')}
            </Link>
          }
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {view.results.map((result) => (
            <ExerciseResult key={result.slug} result={result} />
          ))}
        </ul>
      )}
    </div>
  );
}

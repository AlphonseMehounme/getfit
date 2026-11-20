import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ExerciseDetail } from '@/components/library/exercise-detail';
import { LIBRARY_PATH } from '@/lib/auth/paths';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getExerciseDetail } from '@/server/services/library';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Library');
  return { title: t('title') };
}

// PRD §6.7 exercise detail, found by its slug only (AGENTS §8).
export default async function ExercisePage({ params }: { params: Promise<{ slug: string }> }) {
  const exercise = await getExerciseDetail(await createSupabaseServerClient(), (await params).slug);
  if (!exercise) return redirectToLogin();
  if (exercise === 'not_found') notFound();
  const t = await getTranslations('Library.detail');

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={LIBRARY_PATH}
        className="text-accent inline-flex min-h-12 items-center font-semibold underline-offset-4 hover:underline"
      >
        {t('back')}
      </Link>
      <ExerciseDetail exercise={exercise} />
    </div>
  );
}

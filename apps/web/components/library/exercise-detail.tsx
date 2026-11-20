import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { ExerciseMedia } from '@/components/exercise/exercise-media';
import { exercisePath } from '@/lib/library/paths';
import type { ExerciseDetail as Detail } from '@/server/services/library';
import { ExerciseHistory } from './exercise-history';

// PRD §6.7 exercise detail: media (its own, or the category fallback with "Illustration coming soon", AGENTS §8),
// description, steps, common mistakes, muscles, equipment, related exercises and the user's history.

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Related({ items }: { items: Detail['variations'] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {items.map((item) => (
        <li key={item.slug}>
          <Link
            href={exercisePath(item.slug)}
            className="border-control hover:bg-surface focus-visible:outline-focus rounded-control inline-flex min-h-12 items-center border px-4 font-medium focus-visible:outline-2"
          >
            {item.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ExerciseDetail({ exercise }: { exercise: Detail }) {
  const t = useTranslations();
  return (
    <div className="flex flex-col gap-6">
      <ExerciseMedia
        media={exercise.media}
        exerciseName={exercise.name}
        sizes="(min-width: 768px) 42rem, 100vw"
      />
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">{exercise.name}</h1>
        <p className="text-muted text-sm">
          {t(`Library.categories.${exercise.category}`)} ·{' '}
          {t(`Library.difficulties.${exercise.difficulty as 'beginner'}`)}
          {exercise.isUnilateral ? ` · ${t('Library.detail.perSide')}` : null}
        </p>
        <p>{exercise.description}</p>
      </header>
      <Section id="exercise-steps" title={t('Library.detail.steps')}>
        <ol className="flex list-decimal flex-col gap-2 pl-5">
          {exercise.instructions.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </Section>
      {exercise.commonMistakes.length > 0 ? (
        <Section id="exercise-mistakes" title={t('Library.detail.mistakes')}>
          <ul className="text-muted flex list-disc flex-col gap-1 pl-5">
            {exercise.commonMistakes.map((mistake) => (
              <li key={mistake}>{mistake}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <dt className="font-semibold">{t('Library.detail.muscles')}</dt>
          <dd className="text-muted">
            {exercise.muscleGroups.map((m) => t(`Library.muscles.${m as 'lats'}`)).join(', ')}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="font-semibold">{t('Library.detail.equipment')}</dt>
          <dd className="text-muted">
            {exercise.equipment.map((e) => t(`Onboarding.equipment.options.${e}`)).join(', ')}
          </dd>
        </div>
      </dl>
      {exercise.variations.length > 0 ? (
        <Section id="exercise-variations" title={t('Library.detail.variations')}>
          <Related items={exercise.variations} />
        </Section>
      ) : null}
      {exercise.substitutes.length > 0 ? (
        <Section id="exercise-substitutes" title={t('Library.detail.substitutes')}>
          <Related items={exercise.substitutes} />
        </Section>
      ) : null}
      <ExerciseHistory entries={exercise.history} isRun={exercise.category === 'running'} />
    </div>
  );
}

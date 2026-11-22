import type { PainArea } from '@getfit/domain';
import { CircleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';

// BR-27 / D72: reported pain gets a cautious, non-diagnostic message: reduce or rest, and seek professional advice if
// it is sharp, persistent or worsening. Red is for pain warnings (AGENTS §9); the icon and title carry it too.
export function PainMessage({ area }: { area: PainArea | null }) {
  const t = useTranslations('Review');
  return (
    <section
      aria-labelledby="review-pain"
      className="rounded-card border-danger flex gap-3 border-2 p-4"
    >
      <CircleAlert aria-hidden="true" className="text-danger mt-0.5 size-5 shrink-0" />
      <div className="flex flex-col gap-2">
        <h2 id="review-pain" className="font-semibold">
          {t('pain.title')}
        </h2>
        <p>{t('pain.body', { area: t(`areas.${area ?? 'other'}`).toLowerCase() })}</p>
        <p className="text-muted text-sm">{t('pain.note')}</p>
      </div>
    </section>
  );
}

import { TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';

// BR-19: a target raised by an accepted progression says so, by an icon and a word, never colour alone.
export function ProgressedLabel() {
  const t = useTranslations('Today');
  return (
    <span className="text-accent inline-flex items-center gap-1 text-sm font-medium">
      <TrendingUp aria-hidden="true" className="size-4" />
      {t('progressed')}
    </span>
  );
}

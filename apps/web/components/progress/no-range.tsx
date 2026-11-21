import { useTranslations } from 'next-intl';
import { EmptyState } from '@/components/ui/empty-state';
import { START_PATH, TRAIN_PATH } from '@/lib/auth/paths';
import { ActionLink } from './action-link';

// D74: a range with nothing to show: "programme" without an enrolment, or "all" with nothing logged (BR-24).
export function NoRange({ range }: { range: 'programme' | 'other' }) {
  const t = useTranslations('Progress.noRange');
  const key = range === 'programme' ? 'programme' : 'all';
  return (
    <EmptyState
      title={t(`${key}.title`)}
      description={t(`${key}.description`)}
      action={
        <ActionLink href={range === 'programme' ? START_PATH : TRAIN_PATH}>
          {t(`${key}.action`)}
        </ActionLink>
      }
    />
  );
}

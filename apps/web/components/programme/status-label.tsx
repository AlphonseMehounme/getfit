import type { SessionStatus } from '@getfit/domain';
import { useTranslations } from 'next-intl';
import { statusStyle } from '@/components/ui/week-strip';
import { cn } from '@/lib/utils/cn';

/** A session's status as an icon and its name, never colour alone (WCAG 1.4.1), as on the week strip. */
export function StatusLabel({ status }: { status: SessionStatus }) {
  const t = useTranslations('WeekStrip.status');
  const { icon: Icon, tone } = statusStyle[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm font-medium">
      <Icon aria-hidden="true" data-status={status} className={cn('size-4', tone)} />
      {t(status)}
    </span>
  );
}

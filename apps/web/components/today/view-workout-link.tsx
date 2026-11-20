import { Eye } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

/** PRD §6.3 "View completed": opens the saved workout (BR-25), in the place of Start or Resume. */
export function ViewWorkoutLink({ href, label }: { href: string; label?: string }) {
  const t = useTranslations('Today.action');
  return (
    <Link
      href={href}
      className="border-control hover:bg-surface focus-visible:outline-focus rounded-control inline-flex min-h-12 w-full items-center justify-center gap-2 border px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <Eye aria-hidden="true" className="size-5" />
      {label ?? t('view')}
    </Link>
  );
}

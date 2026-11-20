import { BookOpen } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { LIBRARY_PATH } from '@/lib/auth/paths';

// PRD §9: the library is reached from Train and Profile on mobile (the desktop sidebar also lists it).
export function LibraryShortcut() {
  const t = useTranslations('Library');
  return (
    <Link
      href={LIBRARY_PATH}
      className="border-control hover:bg-surface focus-visible:outline-focus rounded-control inline-flex min-h-12 items-center justify-center gap-2 border px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <BookOpen aria-hidden="true" className="size-4" />
      {t('shortcut')}
    </Link>
  );
}

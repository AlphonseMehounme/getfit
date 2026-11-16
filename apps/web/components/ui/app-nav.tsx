'use client';

import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';

// PRD §9 navigation: a bottom bar on mobile, a sidebar from `md`. It renders only the destinations it is
// given, so it never shows a route that doesn't exist yet (no dead links, AGENTS §9).

export interface NavItem {
  href: string;
  /** Already translated. */
  label: string;
  icon: LucideIcon;
}

const isCurrent = (pathname: string, href: string) =>
  pathname === href || pathname.startsWith(`${href}/`);

export function AppNav({ items }: { items: readonly NavItem[] }) {
  const t = useTranslations('Nav');
  const pathname = usePathname();

  return (
    <nav
      aria-label={t('label')}
      className={cn(
        'bg-background border-border fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)]',
        'md:static md:w-56 md:shrink-0 md:border-t-0 md:border-r md:pb-0',
      )}
    >
      <ul className="flex justify-around md:flex-col md:gap-1 md:p-4">
        {items.map(({ href, label, icon: Icon }) => {
          const current = isCurrent(pathname, href);
          return (
            <li key={href} className="flex-1 md:flex-none">
              <Link
                href={href}
                aria-current={current ? 'page' : undefined}
                className={cn(
                  'rounded-control focus-visible:outline-focus flex min-h-12 flex-col items-center justify-center gap-1 px-2 py-1 text-xs font-medium focus-visible:outline-2 focus-visible:-outline-offset-2',
                  'md:flex-row md:justify-start md:gap-3 md:px-3 md:text-sm',
                  current ? 'text-accent md:bg-surface' : 'text-muted hover:text-foreground',
                )}
              >
                <Icon aria-hidden="true" className="size-5" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

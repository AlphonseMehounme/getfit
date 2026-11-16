import { useTranslations } from 'next-intl';
import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

/** A decorative placeholder block; screen readers hear the surrounding `LoadingRegion` instead. */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        'bg-surface rounded-control animate-pulse motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  );
}

/** Wraps skeletons in `loading.tsx` pages: announced once as "Loading…" (PRD §9 loading states). */
export function LoadingRegion({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const t = useTranslations('States');
  return (
    <div role="status" aria-busy="true" className={cn('flex flex-col gap-4', className)}>
      <span className="sr-only">{t('loading')}</span>
      {children}
    </div>
  );
}

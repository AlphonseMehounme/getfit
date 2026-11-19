import { CircleAlert, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

// Design-system notice (PRD §9): amber = attention, neutral = information. The tone is carried by an icon and the
// title too, never by colour alone (WCAG 2.2 AA).

export function Notice({
  tone,
  title,
  children,
  live = false,
}: {
  tone: 'warning' | 'info';
  title: string;
  children: ReactNode;
  /** Announced as soon as it appears, e.g. a confirmation asked after a submit. */
  live?: boolean;
}) {
  const Icon = tone === 'warning' ? CircleAlert : Info;
  return (
    <div
      role={live ? 'status' : undefined}
      className={cn(
        'rounded-control flex gap-3 border px-4 py-3',
        tone === 'warning' ? 'border-warning' : 'border-control bg-surface',
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn('mt-0.5 size-5 shrink-0', tone === 'warning' ? 'text-warning' : 'text-muted')}
      />
      <div className="flex flex-col gap-1">
        <p className="font-semibold">{title}</p>
        <div className="text-muted text-sm">{children}</div>
      </div>
    </div>
  );
}

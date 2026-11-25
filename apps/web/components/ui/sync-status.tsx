'use client';

import { CloudCheck, CloudOff, HardDrive } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { OutboxStatus } from '@/lib/offline/outbox';
import { cn } from '@/lib/utils/cn';

// D89 / PRD §12: the quiet indicator of where the user's writes are: on the server, saved on this device, or not sent
// after three tries, with a retry. An icon and words, never colour alone; changes are announced.
const ICONS = { synced: CloudCheck, saved: HardDrive, failed: CloudOff } as const;

export function SyncStatus({ status, onRetry }: { status: OutboxStatus; onRetry: () => void }) {
  const t = useTranslations('Sync');
  const Icon = ICONS[status];
  return (
    <div className="flex items-center gap-2 text-sm">
      <p
        role="status"
        className={cn(
          'inline-flex items-center gap-1.5',
          status === 'failed' ? 'text-warning' : 'text-muted',
        )}
      >
        <Icon aria-hidden="true" className="size-4" />
        {t(status)}
      </p>
      {status === 'failed' ? (
        <button
          type="button"
          onClick={onRetry}
          className="text-accent focus-visible:outline-focus rounded-control min-h-12 px-2 font-semibold underline-offset-4 hover:underline focus-visible:outline-2"
        >
          {t('retry')}
        </button>
      ) : null}
    </div>
  );
}

'use client';

import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { skipSessionSchema } from '@/lib/validation/programme';

// PRD §6.4 / D57: skip with an optional reason. The reason is personal: stored with the skip, never sent to
// analytics (AGENTS §12). Its length is checked with the server's schema (AGENTS §2).

export function SkipDialog({
  open,
  onClose,
  programmeDayId,
  pending,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  programmeDayId: string;
  pending: boolean;
  onConfirm: (reason: string) => void;
}) {
  const t = useTranslations('Programme.skip');
  const id = useId();
  const [reason, setReason] = useState('');
  const valid = skipSessionSchema.safeParse({ programmeDayId, reason }).success;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t('title')}
      description={t('description')}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button disabled={!valid || pending} onClick={() => onConfirm(reason)}>
            {t('confirm')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${id}-reason`}>{t('reason')}</Label>
        <textarea
          id={`${id}-reason`}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={3}
          aria-describedby={`${id}-hint${valid ? '' : ` ${id}-error`}`}
          aria-invalid={valid ? undefined : true}
          className="border-control bg-background text-foreground rounded-control focus-visible:outline-focus aria-invalid:border-danger w-full border px-4 py-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2"
        />
        <p id={`${id}-hint`} className="text-muted text-sm">
          {t('reasonHint', { count: reason.trim().length })}
        </p>
        {valid ? null : (
          <p id={`${id}-error`} className="text-danger text-sm">
            {t('reasonTooLong')}
          </p>
        )}
      </div>
    </Dialog>
  );
}

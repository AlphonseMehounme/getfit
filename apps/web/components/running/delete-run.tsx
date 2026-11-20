'use client';

import { Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCallback, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/dialog';
import { FormAlert } from '@/components/ui/form-alert';
import type { DeleteRunResult } from '@/server/services/running';

// PRD §6.6: deleting a run asks for confirmation. It is a soft delete that frees the day the run fulfilled (D26).

export function DeleteRun({
  runId,
  deleteRun,
  afterPath,
}: {
  runId: string;
  deleteRun: (input: { id: string }) => Promise<DeleteRunResult>;
  /** Where to go once the run is deleted. */
  afterPath: string;
}) {
  const t = useTranslations('Run');
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const close = useCallback(() => setOpen(false), []);

  const confirm = () =>
    startTransition(async () => {
      setFailed(false);
      const result = await deleteRun({ id: runId }).catch(() => null);
      if (result?.ok) {
        router.push(afterPath);
        router.refresh();
        return;
      }
      setFailed(true);
    });

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Trash2 aria-hidden="true" className="size-4" />
        {t('record.delete')}
      </Button>
      <Dialog
        open={open}
        onClose={close}
        title={t('delete.title')}
        description={t('delete.body')}
        footer={
          <>
            <Button variant="secondary" onClick={close}>
              {t('delete.cancel')}
            </Button>
            <Button disabled={pending} onClick={confirm}>
              {t('delete.confirm')}
            </Button>
          </>
        }
      >
        {failed ? <FormAlert>{t('delete.error')}</FormAlert> : null}
      </Dialog>
    </>
  );
}

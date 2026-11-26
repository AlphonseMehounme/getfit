'use client';

import { Play } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { useHydrated } from '@/lib/hooks/use-hydrated';

// PRD §6.3: Today's one primary action, reachable without scrolling at 360 px. The session ID is generated on the
// device (D21); the service resumes the day's open session instead when there is one (D32). Starting also asks the
// browser to keep this site's storage, so the workout's outbox isn't evicted (P4-05, D89; Safari evicts otherwise).

export type StartWorkoutAction = (input: {
  sessionId: string;
  programmeDayId: string;
}) => Promise<{ ok: true; sessionId: string } | { ok: false }>;

export function PrimaryAction({
  programmeDayId,
  mode,
  action,
  trainPath,
}: {
  programmeDayId: string;
  mode: 'start' | 'resume';
  action: StartWorkoutAction;
  /** e.g. "/train": the session ID is appended. */
  trainPath: string;
}) {
  const t = useTranslations('Today.action');
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const sessionId = useRef<string | null>(null);
  const hydrated = useHydrated();

  const open = () =>
    startTransition(async () => {
      setFailed(false);
      sessionId.current ??= crypto.randomUUID();
      void navigator.storage?.persist?.().catch(() => false);
      try {
        const result = await action({ sessionId: sessionId.current, programmeDayId });
        if (!result.ok) throw new Error('start refused');
        router.push(`${trainPath}/${result.sessionId}`);
      } catch {
        setFailed(true);
      }
    });

  return (
    <div className="flex flex-col gap-3">
      {failed ? <FormAlert>{t('error')}</FormAlert> : null}
      <Button width="full" onClick={open} disabled={!hydrated || pending}>
        <Play aria-hidden="true" className="size-5" />
        {pending ? t('pending') : t(mode)}
      </Button>
    </div>
  );
}

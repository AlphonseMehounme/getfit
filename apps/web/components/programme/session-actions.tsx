'use client';

import { CalendarClock, SkipForward, Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';
import type { MoveOptions, MoveResult, SkipResult, UndoResult } from '@/server/services/programme';
import { RescheduleSheet } from './reschedule-sheet';
import { SkipDialog } from './skip-dialog';

// PRD §6.4: move, skip or undo one session. Each control shows only when the domain allows it (canMove, canSkip,
// canUndo, D38, D57), so none is dead. The server checks every rule again: a refusal (the week changed since the
// page loaded) is explained and the page refreshed.

export interface SessionActionHandlers {
  move: (input: { programmeDayId: string; date: string }) => Promise<MoveResult>;
  skip: (input: { programmeDayId: string; reason: string }) => Promise<SkipResult>;
  undo: (input: { programmeDayId: string }) => Promise<UndoResult>;
}

/** Noon UTC, formatted in UTC, so the calendar date never shifts with the viewer's time zone. */
const toDate = (date: string) => new Date(`${date}T12:00:00Z`);

type Outcome = { tone: 'done' | 'refused' | 'error'; message: string } | null;

export function SessionActions({
  programmeDayId,
  plannedDate,
  canMove,
  canSkip,
  canUndo,
  undoKind,
  moveOptions,
  actions,
}: {
  programmeDayId: string;
  plannedDate: string;
  canMove: boolean;
  canSkip: boolean;
  canUndo: boolean;
  /** What an undo reverses. */
  undoKind: 'moved' | 'skipped';
  /** Loaded with the page when the session can move. */
  moveOptions: MoveOptions | null;
  actions: SessionActionHandlers;
}) {
  const t = useTranslations('Programme.actions');
  const format = useFormatter();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [panel, setPanel] = useState<'move' | 'skip' | null>(null);
  const [outcome, setOutcome] = useState<Outcome>(null);
  // A panel's own close event only closes that panel, so "Skip instead" can open the dialog from the sheet. Stable
  // callbacks, so the Dialog keeps its close listener across renders and never misses a close.
  const closeMove = useCallback(
    () => setPanel((current) => (current === 'move' ? null : current)),
    [],
  );
  const closeSkip = useCallback(
    () => setPanel((current) => (current === 'skip' ? null : current)),
    [],
  );
  const day = (date: string) =>
    format.dateTime(toDate(date), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    });

  const run = (action: () => Promise<{ ok: true } | { ok: false; error: string }>, done: string) =>
    startTransition(async () => {
      setOutcome(null);
      const result = await action().catch(() => ({ ok: false as const, error: 'error' }));
      setPanel(null);
      if (result.ok) setOutcome({ tone: 'done', message: done });
      else if (result.error === 'error' || result.error === 'invalid_input')
        setOutcome({ tone: 'error', message: t('error') });
      else setOutcome({ tone: 'refused', message: t('refused') });
      router.refresh();
    });

  if (!canMove && !canSkip && !canUndo && !outcome) return null;

  return (
    <section aria-labelledby="session-actions" className="flex flex-col gap-3">
      <h2 id="session-actions" className="text-xl font-semibold">
        {t('title')}
      </h2>
      <div className="flex flex-col gap-3 sm:flex-row">
        {canMove && moveOptions ? (
          <Button variant="secondary" onClick={() => setPanel('move')} disabled={pending}>
            <CalendarClock aria-hidden="true" className="size-5" />
            {t('move')}
          </Button>
        ) : null}
        {canSkip ? (
          <Button variant="secondary" onClick={() => setPanel('skip')} disabled={pending}>
            <SkipForward aria-hidden="true" className="size-5" />
            {t('skip')}
          </Button>
        ) : null}
        {canUndo ? (
          <Button
            variant="secondary"
            disabled={pending}
            onClick={() =>
              run(() => actions.undo({ programmeDayId }), t('undone', { date: day(plannedDate) }))
            }
          >
            <Undo2 aria-hidden="true" className="size-5" />
            {undoKind === 'moved' ? t('undoMove') : t('undoSkip')}
          </Button>
        ) : null}
      </div>
      <p
        role="status"
        className={cn(
          'text-sm',
          outcome?.tone === 'refused' && 'text-warning',
          outcome?.tone === 'error' && 'text-danger',
        )}
      >
        {outcome?.message}
      </p>
      {moveOptions ? (
        <RescheduleSheet
          open={panel === 'move'}
          onClose={closeMove}
          options={moveOptions}
          pending={pending}
          onConfirm={(date) =>
            run(() => actions.move({ programmeDayId, date }), t('moved', { date: day(date) }))
          }
          onSkipInstead={canSkip ? () => setPanel('skip') : undefined}
        />
      ) : null}
      <SkipDialog
        open={panel === 'skip'}
        onClose={closeSkip}
        programmeDayId={programmeDayId}
        pending={pending}
        onConfirm={(reason) => run(() => actions.skip({ programmeDayId, reason }), t('skipped'))}
      />
    </section>
  );
}

'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker';
import { Notice } from '@/components/ui/notice';
import { Sheet } from '@/components/ui/sheet';
import type { MoveOptions } from '@/server/services/programme';

// PRD §6.4: pick a day in the session's week. Blocked days are disabled with each rule explained (BR-9 to BR-12);
// with none left, the sheet recommends skipping and never doubling up (BR-13). Every candidate and block comes from
// the server (getMoveOptions); nothing is decided here.

/** Noon UTC, formatted in UTC, so the calendar date never shifts with the viewer's time zone. */
const toDate = (date: string) => new Date(`${date}T12:00:00Z`);

export function RescheduleSheet({
  open,
  onClose,
  options,
  pending,
  onConfirm,
  onSkipInstead,
}: {
  open: boolean;
  onClose: () => void;
  options: MoveOptions;
  pending: boolean;
  onConfirm: (date: string) => void;
  /** Shown in the BR-13 state, when the session may be skipped. */
  onSkipInstead?: (() => void) | undefined;
}) {
  const t = useTranslations('Programme');
  const format = useFormatter();
  const [date, setDate] = useState<string | null>(null);
  const noDate = options.recommendation === 'skip';
  const dayOptions = options.candidates.map((candidate) => ({
    value: candidate.date,
    label: format.dateTime(toDate(candidate.date), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    }),
    allowed: candidate.allowed,
    reasons: candidate.blocks.map(
      (block) =>
        `${t(`blocks.${block.reason}`, { session: block.blockerTitle ?? '' })} · ${t('reschedule.rule', { rule: block.rule })}`,
    ),
  }));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('reschedule.title')}
      description={t('reschedule.description')}
      footer={
        noDate ? (
          onSkipInstead ? (
            <Button onClick={onSkipInstead}>{t('reschedule.skipInstead')}</Button>
          ) : null
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              {t('reschedule.cancel')}
            </Button>
            <Button disabled={date === null || pending} onClick={() => date && onConfirm(date)}>
              {pending ? t('actions.pending') : t('reschedule.confirm')}
            </Button>
          </>
        )
      }
    >
      {noDate ? (
        <Notice tone="warning" title={t('reschedule.title')}>
          {t('reschedule.noDate')}
        </Notice>
      ) : null}
      <DatePicker
        legend={t('reschedule.legend')}
        options={dayOptions}
        value={date}
        onChange={setDate}
        allowedLabel={t('reschedule.allowed')}
      />
    </Sheet>
  );
}

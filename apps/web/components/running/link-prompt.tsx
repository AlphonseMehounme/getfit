'use client';

import { useFormatter, useTranslations } from 'next-intl';
import { Selector } from '@/components/ui/selector';
import type { RunLinkPrompt } from '@/server/services/running';

// D33: whether a run counts for the long run of its week. The server says what may be offered; the user always
// answers (there is no default, so nothing is linked without their choice). With nothing to offer, the run is saved
// on its own, and the reason is shown only when it would surprise ("already done", "can't move there").

/** Noon UTC, formatted in UTC, so the calendar date never shifts with the viewer's time zone. */
const toDate = (date: string) => new Date(`${date}T12:00:00Z`);

export type LinkAnswer = 'yes' | 'no';

export function LinkPrompt({
  prompt,
  onAnswer,
  error,
}: {
  /** Null while the week is being checked. */
  prompt: RunLinkPrompt | null;
  onAnswer: (answer: LinkAnswer) => void;
  error?: string | undefined;
}) {
  const t = useTranslations('Run.link');
  const format = useFormatter();
  if (!prompt) return <p className="text-muted text-sm">{t('checking')}</p>;
  const session = prompt.longRun?.title ?? '';
  const day = (date: string) =>
    format.dateTime(toDate(date), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      timeZone: 'UTC',
    });

  if (prompt.kind === 'none') {
    if (prompt.reason === 'already_fulfilled')
      return <p className="text-muted text-sm">{t('fulfilled', { session })}</p>;
    if (prompt.reason === 'blocked')
      return <p className="text-muted text-sm">{t('blocked', { session })}</p>;
    return null;
  }

  const question =
    prompt.kind === 'link'
      ? t('link', { session, day: day(prompt.longRun!.date) })
      : t('move', { session, day: day(prompt.date) });
  return (
    <Selector
      // A new question starts unanswered.
      key={`${prompt.kind}-${prompt.programmeDayId}-${prompt.kind === 'move_and_link' ? prompt.date : ''}`}
      legend={question}
      type="radio"
      name="link-answer"
      error={error}
      options={[
        { value: 'yes', label: t('yes') },
        { value: 'no', label: t('no') },
      ]}
      onChange={(event) => onAnswer(event.target.value as LinkAnswer)}
    />
  );
}

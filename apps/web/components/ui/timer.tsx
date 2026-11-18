import { formatDuration } from '@getfit/domain';

// Design-system primitive (PRD §9): a countdown read at arm's length. Key numbers are ≥ 32 px with tabular
// numerals; the progress bar does not animate under reduced motion. Announcements belong to a persistent live
// region on the screen, not here, so they are not lost when the timer closes.

export interface TimerProps {
  /** Accessible name, e.g. "Rest time left". */
  label: string;
  remainingS: number;
  /** The full length, for the progress bar. */
  totalS: number;
}

export function Timer({ label, remainingS, totalS }: TimerProps) {
  const fraction = totalS > 0 ? Math.min(1, remainingS / totalS) : 0;
  return (
    <div className="flex flex-col gap-2">
      <p role="timer" aria-label={label} className="text-5xl font-semibold tabular-nums">
        {formatDuration(remainingS)}
      </p>
      <div aria-hidden="true" className="bg-surface h-2 overflow-hidden rounded-full">
        <div
          data-testid="timer-progress"
          className="bg-accent duration-fast h-full transition-[width] ease-linear motion-reduce:transition-none"
          style={{ width: `${fraction * 100}%` }}
        />
      </div>
    </div>
  );
}

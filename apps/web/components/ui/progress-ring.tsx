import { cn } from '@/lib/utils/cn';

// Design-system progress ring (PRD §9): a share from 0 to 1, drawn as an SVG ring with its value in the middle. It
// is one image with a text label, so the value never relies on the drawing alone (WCAG 1.1.1). No animation.

export function ProgressRing({
  value,
  label,
  text,
  size = 64,
  className,
}: {
  /** 0 to 1. */
  value: number;
  /** The accessible name, already translated, e.g. "Programme progress: 33%". */
  label: string;
  /** Shown in the middle, e.g. "33%". */
  text: string;
  size?: number;
  className?: string;
}) {
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const share = Math.min(1, Math.max(0, value));
  return (
    <div
      role="img"
      aria-label={label}
      className={cn('relative inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        aria-hidden="true"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-surface"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - share)}
          className="stroke-accent"
        />
      </svg>
      <span aria-hidden="true" className="absolute text-sm font-semibold tabular-nums">
        {text}
      </span>
    </div>
  );
}

import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  /**
   * BR-24: explains what is missing and how to get it ("Log a run to see your pace").
   * Takes text only, so an empty state can never show a 0 for a missing metric.
   */
  description: string;
  /** Optional call to action, e.g. a link to log a session. */
  action?: ReactNode;
  icon?: ReactNode;
  headingLevel?: 2 | 3;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  headingLevel = 2,
}: EmptyStateProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <div className="border-border rounded-card flex flex-col items-center gap-3 border border-dashed px-6 py-10 text-center">
      {icon ? (
        <span aria-hidden="true" className="text-muted [&>svg]:size-8">
          {icon}
        </span>
      ) : null}
      <Heading className="text-lg font-semibold">{title}</Heading>
      <p className="text-muted max-w-prose text-sm">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

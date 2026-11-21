import { type ReactNode, useId } from 'react';
import { EmptyState } from '@/components/ui/empty-state';

// The frame every design-system chart shares (PRD §6.8, §12): a titled figure whose drawing is hidden from assistive
// technology, with a summary and a data table in its place (WCAG 1.1.1). With no data it is an empty state with a
// call to action, never empty axes (BR-24).

export interface ChartEmpty {
  /** BR-24: what is missing and how to get it, e.g. "Log a run to see your pace". */
  title: string;
  description: string;
  action?: ReactNode;
}

export function ChartFigure({
  title,
  summary,
  empty,
  isEmpty,
  table,
  hideDrawing = true,
  children,
}: {
  title: string;
  /** One sentence a screen reader hears instead of the drawing. */
  summary: string;
  empty: ChartEmpty;
  isEmpty: boolean;
  /** The data, as an sr-only table. */
  table: ReactNode;
  /**
   * The drawing is hidden from assistive technology. A chart that hides its own drawing (to keep a scroll region
   * reachable by keyboard) passes false.
   */
  hideDrawing?: boolean;
  children: ReactNode;
}) {
  const titleId = useId();
  if (isEmpty) {
    return (
      <EmptyState
        title={empty.title}
        description={empty.description}
        action={empty.action}
        headingLevel={3}
      />
    );
  }
  return (
    <figure aria-labelledby={titleId} className="flex flex-col gap-3">
      <figcaption className="flex flex-col gap-1">
        <span id={titleId} className="text-lg font-semibold">
          {title}
        </span>
        <span className="text-muted text-sm">{summary}</span>
      </figcaption>
      {hideDrawing ? <div aria-hidden="true">{children}</div> : children}
      <div className="sr-only">{table}</div>
    </figure>
  );
}

/** A two-column table of the points: their label and their formatted value. */
export function PointsTable({
  caption,
  categoryLabel,
  valueLabel,
  rows,
}: {
  caption: string;
  categoryLabel: string;
  valueLabel: string;
  rows: readonly { key: string; label: string; value: string }[];
}) {
  return (
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{categoryLabel}</th>
          <th scope="col">{valueLabel}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.key}>
            <th scope="row">{row.label}</th>
            <td>{row.value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

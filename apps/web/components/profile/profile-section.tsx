import { Pencil } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

// D35: one Profile section, with what was saved and a link to edit it (≥ 48 px). An unanswered section offers to
// answer it instead.

const linkClass =
  'border-control hover:bg-surface focus-visible:outline-focus rounded-control inline-flex min-h-12 items-center gap-2 border px-4 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2';

export function ProfileSection({
  id,
  title,
  editHref,
  editLabel,
  editName,
  children,
}: {
  id: string;
  title: string;
  editHref?: string | undefined;
  /** The visible label ("Edit" / "Answer now")… */
  editLabel?: string | undefined;
  /** …and the accessible name, which says which section ("Edit: Goals"). */
  editName?: string | undefined;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={`${id}-heading`}
      className="border-border rounded-card flex flex-col gap-4 border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${id}-heading`} className="text-xl font-semibold">
          {title}
        </h2>
        {editHref ? (
          <Link href={editHref} className={linkClass} aria-label={editName}>
            <Pencil aria-hidden="true" className="size-4" />
            {editLabel}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** A label and its value. */
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-muted text-sm">{label}</dt>
      <dd className="break-words">{children}</dd>
    </div>
  );
}

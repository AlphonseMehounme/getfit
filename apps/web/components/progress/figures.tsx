import type { ReactNode } from 'react';

// Headline figures for a Progress section: a label, its value in tabular numbers, and an optional note.

export function Figures({ children }: { children: ReactNode }) {
  return <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">{children}</dl>;
}

export function Figure({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="rounded-card border-border flex flex-col gap-1 border p-3">
      <dt className="text-muted text-sm">{label}</dt>
      <dd className="text-2xl font-semibold tabular-nums">{value}</dd>
      {note ? <dd className="text-muted text-sm">{note}</dd> : null}
    </div>
  );
}

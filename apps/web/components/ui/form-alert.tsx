import type { ReactNode } from 'react';

/** A form-level error, announced by screen readers as soon as it appears. */
export function FormAlert({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="border-danger text-danger rounded-control border px-4 py-3 text-sm">
      {children}
    </p>
  );
}

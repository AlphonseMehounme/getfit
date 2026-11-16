import type { ComponentProps, ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

// Design-system card (PRD §9). Tokens only (AGENTS §9).
export function Card({ className, ...props }: ComponentProps<'section'>) {
  return (
    <section
      className={cn('border-border bg-background rounded-card border p-4 sm:p-6', className)}
      {...props}
    />
  );
}

interface CardHeaderProps {
  title: ReactNode;
  /** Supporting line under the title, e.g. "Week 3 of 8 · Installation". */
  description?: ReactNode;
  /** The caller picks the level so the page outline stays correct. */
  headingLevel?: 2 | 3;
  id?: string;
}

export function CardHeader({ title, description, headingLevel = 2, id }: CardHeaderProps) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <header className="mb-4 flex flex-col gap-1">
      <Heading id={id} className="text-xl font-semibold tracking-tight">
        {title}
      </Heading>
      {description ? <p className="text-muted text-sm">{description}</p> : null}
    </header>
  );
}

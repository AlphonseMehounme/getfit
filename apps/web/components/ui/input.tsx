import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return (
    <input
      className={cn(
        'border-border bg-background text-foreground min-h-12 w-full rounded-xl border px-4 text-base',
        'focus-visible:outline-accent focus-visible:outline-2 focus-visible:outline-offset-2',
        'aria-invalid:border-danger',
        className,
      )}
      {...props}
    />
  );
}

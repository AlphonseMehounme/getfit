import { cva, type VariantProps } from 'class-variance-authority';
import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils/cn';

// Design-system primitive (PRD §9). Tokens only (AGENTS §9).
const buttonVariants = cva(
  'inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-5 text-base font-semibold transition-colors duration-fast ease-standard focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-foreground hover:bg-accent-hover',
        secondary: 'border border-control bg-background text-foreground hover:bg-surface',
      },
      width: { auto: '', full: 'w-full' },
    },
    defaultVariants: { variant: 'primary', width: 'auto' },
  },
);

export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants>;

export function Button({ className, variant, width, type = 'button', ...props }: ButtonProps) {
  return (
    <button type={type} className={cn(buttonVariants({ variant, width }), className)} {...props} />
  );
}

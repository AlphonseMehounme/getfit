'use client';

import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { type ReactNode, useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils/cn';

// Design-system modal (PRD §9), built on the native <dialog>: showModal() traps focus and makes the rest of
// the page inert; Escape closes it. Focus returns to the element that opened it (WCAG 2.4.3).

export interface DialogProps {
  open: boolean;
  /** Called on Escape, on the close button, or when the dialog is closed any other way. */
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  /** Actions shown at the bottom, e.g. "Save as partial" / "Keep going". */
  footer?: ReactNode;
  /** `sheet` slides from the bottom on mobile and from the side on desktop (see Sheet). */
  variant?: 'dialog' | 'sheet';
}

const SURFACE = {
  dialog: 'm-auto w-[calc(100%-2rem)] max-w-md rounded-card',
  sheet:
    'mt-auto mb-0 w-full max-w-none rounded-t-card md:my-0 md:mr-0 md:ml-auto md:h-full md:max-h-none md:w-96 md:rounded-none md:rounded-l-card',
} as const;

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  variant = 'dialog',
}: DialogProps) {
  const t = useTranslations('Dialog');
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLOrSVGElement | null>(null);
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const dialog = ref.current!;
    if (open && !dialog.open) {
      // Whatever had focus (a button, a link, an SVG control) gets it back on close.
      opener.current = document.activeElement as HTMLOrSVGElement | null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = ref.current!;
    const handleClose = () => {
      opener.current?.focus();
      opener.current = null;
      onClose();
    };
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      className={cn(
        'bg-background text-foreground border-border max-h-[85dvh] border p-0',
        'backdrop:bg-foreground/40',
        SURFACE[variant],
      )}
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 id={titleId} className="text-xl font-semibold tracking-tight">
              {title}
            </h2>
            {description ? (
              <p id={descriptionId} className="text-muted text-sm">
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => ref.current!.close()}
            aria-label={t('close')}
            className="rounded-control hover:bg-surface focus-visible:outline-focus -m-2 inline-flex size-12 shrink-0 items-center justify-center focus-visible:outline-2"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
        {children}
        {footer ? (
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">{footer}</div>
        ) : null}
      </div>
    </dialog>
  );
}

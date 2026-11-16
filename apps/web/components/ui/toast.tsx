'use client';

import { CircleCheck, Info, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { cn } from '@/lib/utils/cn';

// Short confirmations ("Session saved"). The live region is always mounted, so screen readers announce
// each toast politely (WCAG 4.1.3). A toast stays while hovered or focused, so it can be read or dismissed.
// Errors are not toasts: they use ErrorState or inline field errors (red stays for errors, AGENTS §9).

export const TOAST_DURATION_MS = 5000;

type Tone = 'success' | 'info';
interface Toast {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<((message: string, tone?: Tone) => void) | null>(null);

/** Shows a toast. Must be used inside `ToastProvider`. */
export function useToast() {
  const show = useContext(ToastContext);
  if (!show) throw new Error('useToast must be used inside <ToastProvider>');
  return show;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback(
    (id: number) => setToasts((all) => all.filter((t) => t.id !== id)),
    [],
  );
  const show = useCallback((message: string, tone: Tone = 'info') => {
    const id = nextId.current++;
    setToasts((all) => [...all, { id, message, tone }]);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 bottom-24 z-50 flex flex-col items-center gap-2 md:bottom-6"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  const t = useTranslations('Toast');
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => onDismiss(toast.id), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [paused, toast.id, onDismiss]);

  const Icon = toast.tone === 'success' ? CircleCheck : Info;
  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
      className="bg-background border-border rounded-control pointer-events-auto flex w-full max-w-md items-center gap-3 border py-2 pr-2 pl-4 shadow-lg"
    >
      <Icon
        aria-hidden="true"
        className={cn('size-5 shrink-0', toast.tone === 'success' ? 'text-success' : 'text-accent')}
      />
      <p className="flex-1 text-sm">{toast.message}</p>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label={t('dismiss')}
        className="rounded-control hover:bg-surface focus-visible:outline-focus inline-flex size-12 shrink-0 items-center justify-center focus-visible:outline-2"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}

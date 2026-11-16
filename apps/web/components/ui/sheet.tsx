'use client';

import { Dialog, type DialogProps } from './dialog';

/**
 * A panel for secondary content, such as the workout's exercise list (PRD §6.5): from the bottom on mobile,
 * within thumb reach; from the side on desktop. Same accessibility as Dialog.
 */
export function Sheet(props: Omit<DialogProps, 'variant'>) {
  return <Dialog {...props} variant="sheet" />;
}

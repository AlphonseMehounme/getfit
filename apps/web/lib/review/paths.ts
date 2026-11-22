import { PROGRESS_PATH } from '@/lib/auth/paths';

/** PRD §6.9: a week's review, by its Monday (D5). */
export const reviewPath = (weekStart: string) => `${PROGRESS_PATH}/review/${weekStart}`;

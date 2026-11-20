import { LIBRARY_PATH } from '@/lib/auth/paths';

// PRD §6.7: an exercise's library page, found by its slug only (AGENTS §8).
export const exercisePath = (slug: string) => `${LIBRARY_PATH}/${slug}`;

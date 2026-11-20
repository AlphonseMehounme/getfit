import { TRAIN_PATH } from '@/lib/auth/paths';

// PRD §6.6: the run log's pages.
export const newRunPath = (date?: string) => `${TRAIN_PATH}/run/new${date ? `?date=${date}` : ''}`;
export const runPath = (runId: string) => `${TRAIN_PATH}/run/${runId}`;
export const editRunPath = (runId: string) => `${TRAIN_PATH}/run/${runId}/edit`;

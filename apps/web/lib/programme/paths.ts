import { PROGRAMME_PATH } from '@/lib/auth/paths';

// PRD §6.4: the programme screens.
export const weekPath = (weekNumber: number) => `${PROGRAMME_PATH}/week/${weekNumber}`;
export const dayPath = (programmeDayId: string) => `${PROGRAMME_PATH}/day/${programmeDayId}`;

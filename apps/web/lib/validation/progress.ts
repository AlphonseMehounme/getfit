import { PROGRESS_RANGES } from '@getfit/domain';
import { z } from 'zod';

// D74: the Progress range, from the address. A missing or unknown value reads as 8 weeks, the programme's length.
export const DEFAULT_PROGRESS_RANGE = '8w';
export const progressRangeSchema = z.enum(PROGRESS_RANGES).catch(DEFAULT_PROGRESS_RANGE);

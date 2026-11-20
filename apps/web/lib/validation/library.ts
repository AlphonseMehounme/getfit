import { z } from 'zod';
import { EQUIPMENT_TYPES } from './onboarding';

// PRD §6.7: the library's search and filters, from the URL. A value that isn't one is dropped, not an error: the
// page then shows the unfiltered list.

const optional = <T extends z.ZodType>(schema: T) => schema.optional().catch(undefined);

export const libraryFiltersSchema = z.object({
  query: optional(z.string().trim().max(80)),
  category: optional(z.enum(['upper', 'lower', 'core', 'recovery', 'mobility', 'running'])),
  equipment: optional(z.enum(EQUIPMENT_TYPES)),
  muscle: optional(z.string().regex(/^[a-z_]{2,30}$/)),
  difficulty: optional(z.enum(['beginner', 'intermediate', 'advanced'])),
});

export type LibraryFilterInput = z.output<typeof libraryFiltersSchema>;

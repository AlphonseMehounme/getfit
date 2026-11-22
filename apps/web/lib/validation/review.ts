import { PAIN_AREAS } from '@getfit/domain';
import { z } from 'zod';
import { localDateSchema } from './programme';

// PRD §6.9 / D72: the weekly review's check-in, validated on the server (AGENTS §2). Scales are 1–5 or unanswered;
// pain details exist only with pain (BR-27, as the table's check). The weight is optional (D67, D77).

const scale = z.int().min(1).max(5).nullable();

export const reviewInputSchema = z
  .strictObject({
    id: z.uuid(),
    weekStart: localDateSchema,
    fatigue: scale,
    soreness: scale,
    sleep: scale,
    motivation: scale,
    pain: z.boolean(),
    painArea: z.enum(PAIN_AREAS).nullable(),
    painNote: z.string().trim().max(500).nullable(),
    notes: z.string().trim().max(1000).nullable(),
    weight: z
      .strictObject({
        id: z.uuid(),
        value: z.number().positive().max(999),
        unit: z.enum(['kg', 'lb']),
      })
      .nullable(),
  })
  // D72: with pain, where it hurts; without pain, no details.
  .refine((r) => !r.pain || r.painArea !== null, {
    message: 'painAreaRequired',
    path: ['painArea'],
  })
  .refine((r) => r.pain || (r.painArea === null && r.painNote === null), {
    message: 'painDetailsWithoutPain',
    path: ['painArea'],
  });

export type ReviewInput = z.infer<typeof reviewInputSchema>;

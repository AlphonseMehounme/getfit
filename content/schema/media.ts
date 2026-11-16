import { z } from 'zod';
import { EXERCISE_CATEGORIES } from './exercise.ts';

// PRD §8 / AGENTS §8: `content/media/manifest.json` maps each exercise slug to its media.
// Media is found only through this manifest, by slug; never by position, file-name guess or reuse.

const text = z.string().trim().min(1);
const FILE = /^[a-z0-9]+(-[a-z0-9]+)*\.(jpg|webp)$/;

/** D27: licence accepted only for development placeholders. */
export const DEV_ONLY_LICENCE = 'unknown-dev-only';
/** D27: the commissioned set is 4:3, 1,200 × 900 WebP. */
export const FINAL_SIZE = { width: 1200, height: 900, format: 'webp' } as const;

const asset = {
  file: z.string().regex(FILE),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  format: z.enum(['jpeg', 'webp']),
  alt: z.object({ fr: text, en: text }).strict(),
  licence: text,
  source: text,
  /** PRD §8: a human checked this image against its exercise. */
  verified_by: text,
};

const placeholderEntry = z.object({ status: z.literal('placeholder'), ...asset }).strict();
const finalEntry = z.object({ status: z.literal('final'), ...asset }).strict();
/** A2-11: no file; the category fallback ("Illustration coming soon") is shown instead. */
const fallbackEntry = z.object({ status: z.literal('fallback'), reason: text }).strict();

export const mediaEntrySchema = z.discriminatedUnion('status', [
  placeholderEntry,
  finalEntry,
  fallbackEntry,
]);

export const mediaManifestSchema = z
  .object({
    version: z.number().int().positive(),
    exercises: z.record(z.string(), mediaEntrySchema),
    /** One fallback per category (D28), until the commissioned category illustrations arrive. */
    categories: z
      .object(
        Object.fromEntries(
          EXERCISE_CATEGORIES.map((c) => [c, z.object({ status: z.literal('fallback') }).strict()]),
        ) as Record<
          (typeof EXERCISE_CATEGORIES)[number],
          z.ZodObject<{ status: z.ZodLiteral<'fallback'> }>
        >,
      )
      .strict(),
    /** Files that must never be shipped or referenced (PRD §4 audit, D19). */
    rejected: z.array(z.object({ file: text, reason: text }).strict()),
  })
  .strict();

export type MediaManifest = z.infer<typeof mediaManifestSchema>;
export type MediaEntry = z.infer<typeof mediaEntrySchema>;
export type MediaAsset = Extract<MediaEntry, { file: string }>;

export const hasFile = (entry: MediaEntry): entry is MediaAsset => entry.status !== 'fallback';

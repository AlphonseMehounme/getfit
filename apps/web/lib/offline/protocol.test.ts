import { describe, expect, it } from 'vitest';
import { SYNC_BATCH, syncRequestSchema, syncResponseSchema } from './protocol';

const write = (n: number) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  kind: 'set.upsert',
  payload: { any: 'thing' },
  clientUpdatedAt: '2026-11-23T08:00:00+01:00',
});

describe('the sync protocol (D89)', () => {
  it('a batch of 1 to 50 writes of a known kind, each with its device ID', () => {
    expect(syncRequestSchema.safeParse({ writes: [write(1)] }).success).toBe(true);
    const full = Array.from({ length: SYNC_BATCH }, (_, i) => write(i));
    expect(syncRequestSchema.safeParse({ writes: full }).success).toBe(true);
    expect(syncRequestSchema.safeParse({ writes: [...full, write(99)] }).success).toBe(false);
    expect(syncRequestSchema.safeParse({ writes: [] }).success).toBe(false);
    // D87: only workouts and runs work offline.
    expect(
      syncRequestSchema.safeParse({ writes: [{ ...write(1), kind: 'review.save' }] }).success,
    ).toBe(false);
    expect(syncRequestSchema.safeParse({ writes: [{ ...write(1), id: 'x' }] }).success).toBe(false);
  });

  it('an answer per write: applied, duplicate, conflict or refused', () => {
    const results = ['applied', 'duplicate', 'conflict', 'refused'].map((status, i) => ({
      id: write(i).id,
      status,
    }));
    expect(syncResponseSchema.safeParse({ results }).success).toBe(true);
    expect(
      syncResponseSchema.safeParse({ results: [{ id: write(1).id, status: 'lost' }] }).success,
    ).toBe(false);
  });
});

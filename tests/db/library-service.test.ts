import { randomUUID } from 'node:crypto';
import { fixedClock, prescribedSlots } from '@getfit/domain';
import { afterAll, describe, expect, it } from 'vitest';
import type { Track } from '../../apps/web/lib/observability/analytics';
import { startProgramme } from '../../apps/web/server/services/enrolment';
import { getExerciseDetail, getLibrary } from '../../apps/web/server/services/library';
import { getToday } from '../../apps/web/server/services/schedule';
import { getWorkout, logSet, startSession } from '../../apps/web/server/services/workout';
import { anonClient, createTestUser, type TestUser } from './helpers';

// P2-14 · the exercise library against the seeded content (PRD §6.7, §8). Week 1 starts on Monday 23 Nov 2026.

const at = (iso: string) => fixedClock(new Date(iso));
const noTrack: Track = async () => undefined;
const users: TestUser[] = [];
afterAll(async () => {
  await Promise.all(users.map((u) => u.remove()));
});
async function newUser(locale: 'en' | 'fr' = 'en') {
  const user = await createTestUser({ metadata: { locale, timezone: 'Europe/Paris' } });
  users.push(user);
  return user;
}

describe('getLibrary (PRD §6.7)', () => {
  it('all 19 seeded exercises, and "traction" and "pull-up" find the same one in both languages', async () => {
    const user = await newUser();
    const all = (await getLibrary(user.client, {}))!;
    expect(all.results).toHaveLength(19);
    expect(all.options.equipment).toEqual(['bodyweight', 'pull_up_bar']);
    for (const query of ['traction', 'pull-up']) {
      expect((await getLibrary(user.client, { query }))!.results.map((r) => r.slug)).toContain(
        'pull-up',
      );
    }
    const fr = await newUser('fr');
    const french = (await getLibrary(fr.client, { query: 'pull-up' }))!;
    expect(french.results[0]).toMatchObject({ slug: 'pull-up', name: 'Traction stricte' });
  });

  it('filters narrow the list; unknown values are dropped; signed out is null', async () => {
    const user = await newUser();
    const running = (await getLibrary(user.client, { category: 'running' }))!;
    expect(running.results.map((r) => r.slug)).toEqual(['long-run']);
    const bar = (await getLibrary(user.client, { equipment: 'pull_up_bar', muscle: 'biceps' }))!;
    expect(bar.results.map((r) => r.slug).sort()).toEqual(['chin-up', 'pull-up']);
    const bogus = (await getLibrary(user.client, { category: 'arms' }))!;
    expect(bogus.filters).toEqual({});
    expect(bogus.results).toHaveLength(19);
    expect(await getLibrary(anonClient(), {})).toBeNull();
  });
});

describe('getExerciseDetail (PRD §6.7, §8)', () => {
  it('content in the user language, relations, media by slug; unknown is not found', async () => {
    const user = await newUser();
    const pullUp = await getExerciseDetail(user.client, 'pull-up');
    if (!pullUp || pullUp === 'not_found') throw new Error('expected the pull-up');
    expect(pullUp.name).toBe('Pull-up');
    expect(pullUp.instructions.length).toBeGreaterThanOrEqual(3);
    expect(pullUp.variations).toEqual([{ slug: 'chin-up', name: 'Chin-up' }]);
    expect(pullUp.media).toMatchObject({ kind: 'image', src: '/media/exercises/pull-up.jpg' });
    const chinUp = await getExerciseDetail(user.client, 'chin-up');
    if (!chinUp || chinUp === 'not_found') throw new Error('expected the chin-up');
    // AGENTS §8: chin-up never borrows the pull-up's image.
    expect(chinUp.media).toEqual({ kind: 'fallback', category: 'upper' });
    expect(chinUp.history).toEqual([]);
    expect(await getExerciseDetail(user.client, 'no-such-exercise')).toBe('not_found');
    expect(await getExerciseDetail(anonClient(), 'pull-up')).toBeNull();
  });

  it('the history: workouts where the exercise was done, newest first, with the best set; never another user', async () => {
    const user = await newUser();
    await startProgramme(
      user.client,
      { mode: 'next_monday' },
      at('2026-11-18T10:00:00+01:00'),
      noTrack,
    );
    const logPullUps = async (iso: string, reps: number[]) => {
      const clock = at(iso);
      const today = await getToday(user.client, clock);
      if (today?.kind !== 'day') throw new Error('expected a programme day');
      const sessionId = randomUUID();
      await startSession(
        user.client,
        { sessionId, programmeDayId: today.sessions[0]!.programmeDayId },
        clock,
        noTrack,
      );
      const slots = prescribedSlots((await getWorkout(user.client, sessionId, clock))!.snapshot);
      const pullUpId = slots[0]!.exerciseId;
      for (const [i, n] of reps.entries()) {
        const slot = slots.filter((s) => s.exerciseId === pullUpId)[i]!;
        await logSet(
          user.client,
          {
            id: randomUUID(),
            sessionId,
            exerciseId: slot.exerciseId,
            setNumber: slot.setNumber,
            side: slot.side,
            actualReps: n,
            completed: true,
          },
          clock,
        );
      }
      return sessionId;
    };
    const monday = await logPullUps('2026-11-23T08:00:00+01:00', [6, 7]);
    const friday = await logPullUps('2026-11-27T08:00:00+01:00', [5, 8]);
    const detail = await getExerciseDetail(user.client, 'pull-up');
    if (!detail || detail === 'not_found') throw new Error('expected the pull-up');
    expect(detail.history).toEqual([
      {
        workoutSessionId: friday,
        date: '2026-11-27',
        setsLogged: 2,
        best: { kind: 'reps', reps: 8 },
      },
      {
        workoutSessionId: monday,
        date: '2026-11-23',
        setsLogged: 2,
        best: { kind: 'reps', reps: 7 },
      },
    ]);
    const other = await newUser();
    const theirs = await getExerciseDetail(other.client, 'pull-up');
    expect(theirs !== 'not_found' && theirs?.history).toEqual([]);
  });
});

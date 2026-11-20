import { randomUUID } from 'node:crypto';
import { fixedClock } from '@getfit/domain';
import { afterAll, describe, expect, it } from 'vitest';
import type { Track } from '../../apps/web/lib/observability/analytics';
import { startProgramme } from '../../apps/web/server/services/enrolment';
import { getTrainHub, HISTORY_PAGE_SIZE } from '../../apps/web/server/services/history';
import { saveOnboardingStep } from '../../apps/web/server/services/onboarding';
import { deleteRun, logRun } from '../../apps/web/server/services/running';
import { getToday } from '../../apps/web/server/services/schedule';
import { startSession } from '../../apps/web/server/services/workout';
import { anonClient, createTestUser, type TestUser } from './helpers';

// P2-15 · Train history against local Supabase (PRD §9, BR-25, BR-26). Week 1 starts on Monday 23 Nov 2026 (Paris).

const at = (iso: string) => fixedClock(new Date(iso));
const MONDAY = at('2026-11-23T08:00:00+01:00');
const LATER = at('2026-12-20T20:00:00+01:00');
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

const run = (day: string, time = '09:30') => ({
  id: randomUUID(),
  startedAt: `${day}T${time}`,
  distance: 5,
  distanceUnit: 'km',
  durationS: 1800,
});

describe('getTrainHub (PRD §9)', () => {
  it('an empty history, with today for the action', async () => {
    const user = await newUser();
    const hub = await getTrainHub(user.client, {}, MONDAY);
    expect(hub).toMatchObject({
      history: [],
      nextBefore: null,
      units: 'metric',
      today: { kind: 'not_enrolled' },
    });
    expect(await getTrainHub(anonClient(), {}, MONDAY)).toBeNull();
  });

  it('workouts and runs together, newest first, titles in the user language; baselines and deleted runs left out', async () => {
    const user = await newUser('fr');
    await startProgramme(
      user.client,
      { mode: 'next_monday' },
      at('2026-11-18T10:00:00+01:00'),
      noTrack,
    );
    const today = await getToday(user.client, MONDAY);
    if (today?.kind !== 'day') throw new Error('expected a programme day');
    const sessionId = randomUUID();
    await startSession(
      user.client,
      { sessionId, programmeDayId: today.sessions[0]!.programmeDayId },
      MONDAY,
      noTrack,
    );
    const tuesday = run('2026-11-24');
    const wednesday = run('2026-11-25');
    await logRun(user.client, tuesday, LATER, noTrack);
    await logRun(user.client, wednesday, LATER, noTrack);
    await deleteRun(user.client, { id: wednesday.id }, LATER);
    await saveOnboardingStep(
      user.client,
      'baselines',
      { run: { id: randomUUID(), distance: 10.84, distanceUnit: 'km', durationS: 4770 } },
      LATER,
    );

    const hub = (await getTrainHub(user.client, {}, LATER))!;
    expect(hub.history.map((item) => [item.kind, item.date])).toEqual([
      ['run', '2026-11-24'],
      ['workout', '2026-11-23'],
    ]);
    expect(hub.history[1]).toMatchObject({
      id: sessionId,
      status: 'in_progress',
      title: 'Séance A — Haut du corps',
      setsLogged: 0,
      durationS: null,
    });
    expect(hub.history[0]).toMatchObject({
      id: tuesday.id,
      distanceM: 5000,
      durationS: 1800,
      linked: false,
    });
    expect(hub.nextBefore).toBeNull();
  });

  it('pages of 20 continue with no row repeated or skipped, also at the same instant', async () => {
    const user = await newUser();
    // 25 runs at five instants, five runs each: ties at every instant.
    const ids: string[] = [];
    for (const day of ['2026-11-24', '2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28']) {
      for (let i = 0; i < 5; i += 1) {
        const r = run(day, '07:00');
        ids.push(r.id);
        expect(await logRun(user.client, r, LATER, noTrack)).toMatchObject({ ok: true });
      }
    }
    const first = (await getTrainHub(user.client, {}, LATER))!;
    expect(first.history).toHaveLength(HISTORY_PAGE_SIZE);
    expect(first.history[0]!.date).toBe('2026-11-28');
    expect(first.nextBefore).toMatch(/^2026-11-\d\dT06:00:00\.000Z\|[0-9a-f-]{36}$/);
    const second = (await getTrainHub(user.client, { before: first.nextBefore! }, LATER))!;
    expect(second.history).toHaveLength(5);
    expect(second.nextBefore).toBeNull();
    const seen = [...first.history, ...second.history].map((item) => item.id);
    expect(new Set(seen).size).toBe(25);
    expect([...seen].sort()).toEqual([...ids].sort());
  });

  it("an invalid cursor reads as the first page; another user's rows never show", async () => {
    const a = await newUser();
    const b = await newUser();
    await logRun(a.client, run('2026-11-24'), LATER, noTrack);
    expect((await getTrainHub(a.client, { before: 'nope' }, LATER))!.history).toHaveLength(1);
    expect(
      (await getTrainHub(
        a.client,
        { before: 'not-a-date|00000000-0000-4000-8000-000000000001' },
        LATER,
      ))!.history,
    ).toHaveLength(1);
    expect((await getTrainHub(b.client, {}, LATER))!.history).toEqual([]);
  });
});

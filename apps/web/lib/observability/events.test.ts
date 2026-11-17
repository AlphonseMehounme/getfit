import { describe, expect, it } from 'vitest';
import { type AnalyticsEvent, EVENT_SCHEMAS, InvalidEventError, parseEvent } from './events';

const ID = '7d6b1f3e-2c4a-4b8e-9f10-1a2b3c4d5e6f';

const VALID: AnalyticsEvent[] = [
  { name: 'account_created', properties: {} },
  { name: 'onboarding_completed', properties: { skipped_steps: 2 } },
  {
    name: 'programme_started',
    properties: { programme_id: ID, user_programme_id: ID, start_mode: 'this_week' },
  },
  {
    name: 'workout_started',
    properties: { workout_session_id: ID, programme_day_id: null, resumed: false },
  },
  {
    name: 'workout_completed',
    properties: { workout_session_id: ID, status: 'partial', sets_logged: 7, duration_s: 1800 },
  },
  { name: 'workout_abandoned', properties: { workout_session_id: ID } },
  {
    name: 'running_session_logged',
    properties: { running_session_id: ID, linked_to_programme: true },
  },
  { name: 'weekly_review_completed', properties: { weekly_review_id: ID } },
  { name: 'programme_completed', properties: { user_programme_id: ID } },
  { name: 'progress_viewed', properties: { range: '8w' } },
  { name: 'session_rescheduled', properties: { programme_day_id: ID, action: 'moved' } },
  { name: 'sync_conflict', properties: { record_type: 'workout_set', record_id: ID } },
];

describe('analytics events', () => {
  it('PRD §12: covers the 12 product events', () => {
    expect(Object.keys(EVENT_SCHEMAS).sort()).toEqual(VALID.map((e) => e.name).sort());
  });

  it.each(VALID)('accepts a valid $name', (event) => {
    expect(parseEvent(event)).toEqual(event);
  });

  it.each([
    ['an unknown property', { name: 'account_created', properties: { email: 'a@b.test' } }],
    ['free text', { name: 'progress_viewed', properties: { range: 'last week, sore knee' } }],
    ['a non-UUID id', { name: 'workout_abandoned', properties: { workout_session_id: 'jane' } }],
    ['a negative count', { name: 'onboarding_completed', properties: { skipped_steps: -1 } }],
    ['an unknown event', { name: 'pain_reported', properties: {} }],
    ['missing properties', { name: 'workout_abandoned', properties: undefined }],
  ])('AGENTS §12: rejects %s at runtime', (_case, event) => {
    expect(() => parseEvent(event)).toThrow(InvalidEventError);
  });

  it('AGENTS §12: rejects personal properties at the type level', () => {
    const event: AnalyticsEvent = {
      name: 'account_created',
      // @ts-expect-error: personal data is not an allowed property
      properties: { email: 'a@b.test' },
    };
    expect(() => parseEvent(event)).toThrow(InvalidEventError);
  });
});

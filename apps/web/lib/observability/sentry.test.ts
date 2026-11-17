import type { ErrorEvent } from '@sentry/nextjs';
import { describe, expect, it } from 'vitest';
import { scrubBreadcrumb, scrubData, scrubEvent, sentryOptions, stripQuery } from './sentry';

const FIXTURE: ErrorEvent = {
  type: undefined,
  event_id: 'abc',
  level: 'error',
  message: 'Sign-up failed for jane.doe@example.test',
  user: {
    id: 'user-1',
    email: 'jane.doe@example.test',
    ip_address: '203.0.113.7',
    username: 'jane',
  },
  request: {
    url: 'https://getfit.app/auth/confirm?token_hash=secret&type=email',
    method: 'GET',
    cookies: { 'sb-access-token': 'secret' },
    headers: { cookie: 'sb=secret', 'user-agent': 'Mobile Safari', authorization: 'Bearer x' },
    data: { email: 'jane.doe@example.test', password: 'hunter2' },
    query_string: 'token_hash=secret',
  },
  exception: {
    values: [
      {
        type: 'Error',
        value: 'User jane.doe@example.test not found',
        stacktrace: { frames: [{ lineno: 12 }] },
      },
      { type: 'Error' },
    ],
  },
  extra: {
    workout_session_id: 'session-1',
    sets_logged: 7,
    review: { notes: 'Knee hurts', pain_location: 'left knee', pain: true, fatigue: 4 },
    profile: { first_name: 'Jane', birth_year: 1998 },
  },
  contexts: { form: { email: 'jane.doe@example.test', fields: ['email'] } },
  breadcrumbs: [
    {
      category: 'navigation',
      data: { from: '/login?next=/today', to: '/auth/confirm?token_hash=secret' },
    },
    {
      category: 'fetch',
      message: 'POST for jane.doe@example.test',
      data: { url: '/api?email=x', status_code: 500 },
    },
    { category: 'ui.click' },
  ],
};

describe('scrubEvent', () => {
  const event = scrubEvent(FIXTURE);
  const json = JSON.stringify(event);

  it('AGENTS §12: no email, name, note, pain detail, token or IP survives', () => {
    for (const secret of [
      'jane.doe@example.test',
      'Jane',
      'Knee hurts',
      'left knee',
      'token_hash',
      'secret',
      '203.0.113.7',
      'hunter2',
      'Bearer',
    ]) {
      expect(json).not.toContain(secret);
    }
  });

  it('keeps only the user id, and the request method, path and user agent', () => {
    expect(event.user).toEqual({ id: 'user-1' });
    expect(event.request).toEqual({
      url: 'https://getfit.app/auth/confirm',
      method: 'GET',
      headers: { 'user-agent': 'Mobile Safari' },
    });
  });

  it('keeps what is needed to debug: ids, counts, booleans, stack frames and level', () => {
    expect(event.level).toBe('error');
    expect(event.extra).toMatchObject({ workout_session_id: 'session-1', sets_logged: 7 });
    expect(event.extra!.review).toEqual({
      notes: '[Filtered]',
      pain_location: '[Filtered]',
      pain: '[Filtered]',
      fatigue: 4,
    });
    expect(event.extra!.profile).toEqual({ first_name: '[Filtered]', birth_year: '[Filtered]' });
    expect(event.exception!.values![0]!.value).toBe('User [email] not found');
    expect(event.exception!.values![0]!.stacktrace!.frames).toEqual([{ lineno: 12 }]);
    expect(event.message).toBe('Sign-up failed for [email]');
  });

  it('strips query strings and personal values from breadcrumbs', () => {
    expect(event.breadcrumbs![0]!.data).toEqual({ from: '/login', to: '/auth/confirm' });
    expect(event.breadcrumbs![1]).toMatchObject({
      message: 'POST for [email]',
      data: { url: '/api', status_code: 500 },
    });
    expect(event.breadcrumbs![2]).toEqual({ category: 'ui.click' });
  });

  it('leaves an event with no user or request as it is', () => {
    expect(scrubEvent({ type: undefined, level: 'info' })).toEqual({
      type: undefined,
      level: 'info',
    });
  });

  it('leaves a minimal event untouched', () => {
    const minimal: ErrorEvent = { type: undefined, level: 'warning', user: {}, request: {} };
    expect(scrubEvent(minimal)).toEqual({
      type: undefined,
      level: 'warning',
      user: {},
      request: {},
    });
  });
});

describe('scrub helpers', () => {
  it('strips query strings and fragments only when present', () => {
    expect(stripQuery('/today')).toBe('/today');
    expect(stripQuery('/a#b')).toBe('/a');
  });

  it('handles arrays, nulls and very deep data', () => {
    expect(scrubData([{ email: 'x' }, null, 3])).toEqual([{ email: '[Filtered]' }, null, 3]);
    let deep: Record<string, unknown> = { leaf: true };
    for (let i = 0; i < 12; i++) deep = { next: deep };
    expect(() => scrubData(deep)).not.toThrow();
  });

  it('passes a breadcrumb without data through, masking its message', () => {
    expect(scrubBreadcrumb({ message: 'hi a@b.test' })).toEqual({ message: 'hi [email]' });
  });
});

describe('sentryOptions', () => {
  it('is disabled without a DSN, as in local development and tests', () => {
    expect(sentryOptions({})).toMatchObject({
      dsn: undefined,
      enabled: false,
      environment: 'development',
    });
    expect(sentryOptions({ NEXT_PUBLIC_SENTRY_DSN: '' }).enabled).toBe(false);
  });

  it('PRD §12: sends no default PII and scrubs every event and breadcrumb', () => {
    const options = sentryOptions({
      NEXT_PUBLIC_SENTRY_DSN: 'https://k@o1.ingest.de.sentry.io/1',
      NODE_ENV: 'production',
    });
    expect(options).toMatchObject({
      enabled: true,
      environment: 'production',
      sendDefaultPii: false,
      tracesSampleRate: 0.1,
    });
    expect(options.beforeSend).toBe(scrubEvent);
    expect(options.beforeBreadcrumb({ message: 'a@b.test' })).toEqual({ message: '[email]' });
  });

  it('names the environment after the Vercel deployment first', () => {
    expect(sentryOptions({ VERCEL_ENV: 'preview', NODE_ENV: 'production' }).environment).toBe(
      'preview',
    );
  });
});

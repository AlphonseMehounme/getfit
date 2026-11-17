import * as Sentry from '@sentry/nextjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTracker, POSTHOG_EU_HOST } from './analytics';
import type { AnalyticsEvent } from './events';

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn() }));

const USER = '7d6b1f3e-2c4a-4b8e-9f10-1a2b3c4d5e6f';
const EVENT: AnalyticsEvent = { name: 'account_created', properties: {} };

function setup(apiKey: string | undefined, host?: string) {
  const captureImmediate = vi.fn().mockResolvedValue(undefined);
  const factory = vi.fn(() => ({ captureImmediate }));
  const track = createTracker({ apiKey, host }, factory);
  return { track, factory, captureImmediate };
}

describe('createTracker', () => {
  beforeEach(() => vi.mocked(Sentry.captureMessage).mockClear());

  it('is a no-op without a key, as in local development and tests', async () => {
    const { track, factory } = setup(undefined);
    await track(EVENT, USER);
    expect(factory).not.toHaveBeenCalled();
  });

  it('D17: sends to the EU host with the user UUID, no person profile', async () => {
    const { track, factory, captureImmediate } = setup('phc_test');
    await track({ name: 'progress_viewed', properties: { range: '4w' } }, USER);
    expect(factory).toHaveBeenCalledWith('phc_test', POSTHOG_EU_HOST);
    expect(captureImmediate).toHaveBeenCalledWith({
      distinctId: USER,
      event: 'progress_viewed',
      properties: { range: '4w', $process_person_profile: false },
    });
  });

  it('D17: a non-EU host disables analytics', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { track, factory } = setup('phc_test', 'https://us.i.posthog.com');
    await track(EVENT, USER);
    expect(factory).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(
      '[analytics] disabled: POSTHOG_HOST must be the EU host (D17)',
    );
  });

  it('AGENTS §12: never sends an invalid event, and reports it by name only', async () => {
    const { track, captureImmediate } = setup('phc_test', POSTHOG_EU_HOST);
    await track(
      { name: 'account_created', properties: { email: 'jane@example.test' } } as never,
      USER,
    );
    expect(captureImmediate).not.toHaveBeenCalled();
    expect(Sentry.captureMessage).toHaveBeenCalledWith('analytics event rejected', {
      level: 'warning',
      tags: { event: 'account_created' },
    });
  });

  it('never breaks the user action when delivery fails', async () => {
    const { track, captureImmediate } = setup('phc_test');
    captureImmediate.mockRejectedValueOnce(new Error('network down'));
    await expect(track(EVENT, USER)).resolves.toBeUndefined();
    expect(Sentry.captureMessage).toHaveBeenCalledWith('analytics delivery failed', {
      level: 'warning',
      tags: { event: 'account_created' },
    });
  });

  it('builds a real PostHog client by default', () => {
    expect(() => createTracker({ apiKey: 'phc_test', host: POSTHOG_EU_HOST })).not.toThrow();
  });
});

import { describe, expect, it } from 'vitest';
import { parseInstant } from '../time/clock';
import { CLIENT_CLOCK_ALLOWANCE_MS, clientTimeCheck, latestWins } from './conflict';

const at = parseInstant;

describe('D91: latest client_updated_at wins', () => {
  it('keeps the incoming version when it is later', () => {
    expect(latestWins(at('2026-11-23T10:00:00Z'), at('2026-11-23T10:00:01Z'))).toBe('incoming');
  });

  it('keeps the stored version when the incoming one is earlier', () => {
    expect(latestWins(at('2026-11-23T10:00:01Z'), at('2026-11-23T10:00:00Z'))).toBe('stored');
  });

  it('treats equal times as the same edit', () => {
    expect(latestWins(at('2026-11-23T10:00:00Z'), at('2026-11-23T10:00:00.000Z'))).toBe('same');
  });

  it('compares instants, whatever zone each device wrote its time in', () => {
    // 11:00 in Paris (UTC+1) is 05:00 in New York (UTC−5): the same moment, then New York one second later.
    expect(latestWins(at('2026-11-23T11:00:00+01:00'), at('2026-11-23T05:00:00-05:00'))).toBe(
      'same',
    );
    expect(latestWins(at('2026-11-23T11:00:00+01:00'), at('2026-11-23T05:00:01-05:00'))).toBe(
      'incoming',
    );
  });
});

describe("D102: the device's time is used unless it runs ahead", () => {
  const now = at('2026-11-23T10:00:00Z');

  it('accepts a time in the past or up to 5 minutes ahead', () => {
    expect(clientTimeCheck(at('2026-11-16T10:00:00Z'), now)).toBe('ok');
    expect(clientTimeCheck(new Date(now.getTime() + CLIENT_CLOCK_ALLOWANCE_MS), now)).toBe('ok');
  });

  it('refuses a time more than 5 minutes ahead', () => {
    expect(clientTimeCheck(new Date(now.getTime() + CLIENT_CLOCK_ALLOWANCE_MS + 1), now)).toBe(
      'ahead',
    );
  });
});

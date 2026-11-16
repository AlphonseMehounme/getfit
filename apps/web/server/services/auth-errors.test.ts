import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import { AUTH_ERROR_KEYS, toAuthErrorKey } from './auth-errors';

describe('toAuthErrorKey', () => {
  it.each([
    ['invalid_credentials', 'invalidCredentials'],
    ['email_not_confirmed', 'emailNotConfirmed'],
    ['weak_password', 'weakPassword'],
    ['same_password', 'samePassword'],
    ['session_not_found', 'invalidLink'],
    ['over_request_rate_limit', 'rateLimited'],
    ['over_email_send_rate_limit', 'rateLimited'],
    ['otp_expired', 'invalidLink'],
  ])('maps %s to %s', (code, key) => {
    expect(toAuthErrorKey({ code })).toBe(key);
  });

  it('treats any 429 as rate limiting', () => {
    expect(toAuthErrorKey({ status: 429 })).toBe('rateLimited');
  });

  it('never exposes unknown errors', () => {
    expect(toAuthErrorKey({ code: 'something_new', status: 500 })).toBe('unexpected');
    expect(toAuthErrorKey({})).toBe('unexpected');
  });

  it('has a translated message for every key', () => {
    for (const key of AUTH_ERROR_KEYS) expect(en.Auth.errors[key]).toBeTruthy();
  });
});

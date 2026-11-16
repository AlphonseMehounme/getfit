import { describe, expect, it } from 'vitest';
import en from '@/messages/en.json';
import { loginSchema, signUpSchema, VALIDATION_ERROR_KEYS } from './auth';

const firstError = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.error?.issues[0]?.message;

describe('auth validation', () => {
  it('trims and lower-cases the email', () => {
    const parsed = loginSchema.parse({ email: '  Alex@Example.TEST ', password: 'x' });
    expect(parsed.email).toBe('alex@example.test');
  });

  it('rejects an invalid email with a message key', () => {
    expect(firstError(loginSchema.safeParse({ email: 'not-an-email', password: 'x' }))).toBe(
      'emailInvalid',
    );
  });

  it('requires a password to log in', () => {
    expect(firstError(loginSchema.safeParse({ email: 'a@example.test', password: '' }))).toBe(
      'passwordRequired',
    );
  });

  it('needs at least 8 and at most 72 characters to sign up', () => {
    const signUp = (password: string) =>
      signUpSchema.safeParse({ email: 'a@example.test', password });
    expect(firstError(signUp('1234567'))).toBe('passwordTooShort');
    expect(firstError(signUp('x'.repeat(73)))).toBe('passwordTooLong');
    expect(signUp('12345678').success).toBe(true);
  });

  it('accepts only supported locales (D15)', () => {
    const base = { email: 'a@example.test', password: '12345678' };
    expect(signUpSchema.safeParse({ ...base, locale: 'en' }).success).toBe(true);
    expect(signUpSchema.safeParse({ ...base, locale: 'de' }).success).toBe(false);
  });

  it('has a translated message for every validation key', () => {
    for (const key of VALIDATION_ERROR_KEYS) expect(en.Auth.errors[key]).toBeTruthy();
  });
});

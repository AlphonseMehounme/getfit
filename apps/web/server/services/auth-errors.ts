// AGENTS §12: users see a few generic messages; details stay on the server.
export const AUTH_ERROR_KEYS = [
  'invalidCredentials',
  'emailNotConfirmed',
  'weakPassword',
  'rateLimited',
  'invalidLink',
  'invalidInput',
  'unexpected',
] as const;
export type AuthErrorKey = (typeof AUTH_ERROR_KEYS)[number];

/** Supabase Auth error codes: https://supabase.com/docs/guides/auth/debugging/error-codes */
const BY_CODE: Record<string, AuthErrorKey> = {
  invalid_credentials: 'invalidCredentials',
  email_not_confirmed: 'emailNotConfirmed',
  weak_password: 'weakPassword',
  over_request_rate_limit: 'rateLimited',
  over_email_send_rate_limit: 'rateLimited',
  otp_expired: 'invalidLink',
  bad_jwt: 'invalidLink',
  validation_failed: 'invalidInput',
  email_address_invalid: 'invalidInput',
};

export function toAuthErrorKey(error: { code?: string | undefined; status?: number | undefined }) {
  const byCode = error.code ? BY_CODE[error.code] : undefined;
  if (byCode) return byCode;
  if (error.status === 429) return 'rateLimited';
  return 'unexpected';
}

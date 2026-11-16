/**
 * The app's public origin, used to build links in auth emails. It comes from configuration,
 * never from request headers, so a forged Host header can't redirect a confirmation link.
 */
export function appOrigin(): string {
  const origin = process.env.APP_ORIGIN;
  if (!origin) throw new Error('APP_ORIGIN must be set (see .env.example).');
  return new URL(origin).origin;
}

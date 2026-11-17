interface OriginEnv {
  APP_ORIGIN?: string;
  VERCEL_ENV?: string;
  /** Set by Vercel: the stable address of a preview's branch, without the scheme. */
  VERCEL_BRANCH_URL?: string;
  [name: string]: string | undefined;
}

/**
 * The app's public origin, used to build links in auth emails. It comes from configuration, never from request
 * headers, so a forged Host header can't redirect a confirmation link. `APP_ORIGIN` wins; a Vercel preview without
 * it uses its branch URL, which Vercel sets (P1-18, docs/runbooks/preview-deployment.md).
 */
export function appOrigin(env: OriginEnv = process.env): string {
  const branchOrigin =
    env.VERCEL_ENV === 'preview' && env.VERCEL_BRANCH_URL
      ? `https://${env.VERCEL_BRANCH_URL}`
      : undefined;
  const origin = env.APP_ORIGIN || branchOrigin;
  if (!origin) throw new Error('APP_ORIGIN must be set (see .env.example).');
  return new URL(origin).origin;
}

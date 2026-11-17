// Sentry 11 serves the build wrapper from its `config` entry point.
import { withSentryConfig } from '@sentry/nextjs/config';
import type { NextConfig } from 'next';
import { PHASE_PRODUCTION_BUILD } from 'next/constants';
import createNextIntlPlugin from 'next-intl/plugin';
import { assertNoTestClockInBuild } from './server/clock';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  transpilePackages: ['@getfit/domain'],
};

// PRD §12: Sentry. Source maps upload only when SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT are set
// (CI and Vercel); local builds skip it.
const uploadSourceMaps = Boolean(
  process.env.SENTRY_AUTH_TOKEN && process.env.SENTRY_ORG && process.env.SENTRY_PROJECT,
);

const config = withSentryConfig(withNextIntl(nextConfig), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  sourcemaps: { disable: !uploadSourceMaps },
  telemetry: false,
});

// D20: a production build fails if the test clock is set (preview deployments excepted).
export default function nextConfigFor(phase: string) {
  if (phase === PHASE_PRODUCTION_BUILD) assertNoTestClockInBuild(process.env);
  return config;
}

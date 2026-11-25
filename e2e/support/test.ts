import { randomUUID } from 'node:crypto';
import { test as base } from '@playwright/test';

// D101: the server is limited per IP (D86), and every test comes from 127.0.0.1. Under NODE_ENV=test only, this
// header stands in for the IP, so each browser context keeps its own count. Specs import `test` from here.
export const TEST_IP_HEADER = 'x-getfit-test-ip';

/** A fresh stand-in IP, for a context a test opens itself (a second device). */
export const testIpHeaders = () => ({ [TEST_IP_HEADER]: `e2e-${randomUUID()}` });

/** Page-level headers (the D30 clock) are merged over these, so both apply. */
export const test = base.extend({
  context: async ({ context }, provide) => {
    await context.setExtraHTTPHeaders(testIpHeaders());
    await provide(context);
  },
});

export { expect } from '@playwright/test';

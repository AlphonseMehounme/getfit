import { describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };

// AGENTS §5.1: the domain package stays pure. Its only allowed runtime dependencies are
// the date/time libraries chosen in ADR 0002 and Zod (shared schemas).
const ALLOWED_RUNTIME_DEPENDENCIES = new Set(['date-fns', '@date-fns/tz', 'zod']);

describe('@getfit/domain package', () => {
  it('declares only allowed runtime dependencies', () => {
    const runtime = Object.keys(
      (pkg as { dependencies?: Record<string, string> }).dependencies ?? {},
    );
    expect(runtime.filter((name) => !ALLOWED_RUNTIME_DEPENDENCIES.has(name))).toEqual([]);
  });

  it('has no peer dependencies on a framework or database client', () => {
    expect((pkg as { peerDependencies?: Record<string, string> }).peerDependencies).toBeUndefined();
  });
});

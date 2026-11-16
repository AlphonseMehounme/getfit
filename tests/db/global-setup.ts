import { execFileSync } from 'node:child_process';
import type { TestProject } from 'vitest/node';

export interface LocalSupabase {
  apiUrl: string;
  dbUrl: string;
  publishableKey: string;
  /** Test fixtures only (D29): creating and deleting test users. Never used by app code. */
  secretKey: string;
}

declare module 'vitest' {
  export interface ProvidedContext {
    supabase: LocalSupabase;
  }
}

export default function setup(project: TestProject) {
  let status: Record<string, string>;
  try {
    const output = execFileSync('pnpm', ['exec', 'supabase', 'status', '-o', 'json'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    status = JSON.parse(output.slice(output.indexOf('{'))) as Record<string, string>;
  } catch {
    throw new Error('Local Supabase is not running. Start it with `pnpm db:start`.');
  }

  const read = (key: string): string => {
    const value = status[key];
    if (!value) throw new Error(`\`supabase status\` did not report ${key}.`);
    return value;
  };

  project.provide('supabase', {
    apiUrl: read('API_URL'),
    dbUrl: read('DB_URL'),
    publishableKey: read('PUBLISHABLE_KEY'),
    secretKey: read('SECRET_KEY'),
  });
}

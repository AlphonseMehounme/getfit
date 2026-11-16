import { execFileSync } from 'node:child_process';

export interface LocalSupabase {
  apiUrl: string;
  dbUrl: string;
  publishableKey: string;
  /** Test fixtures only (D29): creating and deleting test users. Never used by app code. */
  secretKey: string;
  /** Local mail catcher that receives every auth email. */
  mailpitUrl: string;
}

/** Reads the running local Supabase stack's URLs and keys from `supabase status`. */
export function readLocalSupabase(): LocalSupabase {
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

  return {
    apiUrl: read('API_URL'),
    dbUrl: read('DB_URL'),
    publishableKey: read('PUBLISHABLE_KEY'),
    secretKey: read('SECRET_KEY'),
    mailpitUrl: read('MAILPIT_URL'),
  };
}

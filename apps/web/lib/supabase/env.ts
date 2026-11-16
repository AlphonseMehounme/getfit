// Public Supabase settings. Only the publishable key ever reaches the app (AGENTS §5.5).
// `process.env.NEXT_PUBLIC_*` must be read literally so Next can inline it in client bundles.
export function supabaseEnv(): { url: string; publishableKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be set (see .env.example).',
    );
  }
  return { url, publishableKey };
}

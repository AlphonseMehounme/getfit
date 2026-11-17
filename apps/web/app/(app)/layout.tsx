import type { ReactNode } from 'react';
import { MainNav } from '@/components/layout/main-nav';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/server/services/auth';

// D8 / PRD §6.1: every route in this group needs a signed-in user. proxy.ts redirects first;
// this check verifies the user with Supabase Auth rather than trusting the cookie.
export default async function AppLayout({ children }: { children: ReactNode }) {
  if (!(await getCurrentUser(await createSupabaseServerClient()))) await redirectToLogin();

  return (
    <div className="md:flex md:min-h-dvh">
      <MainNav />
      <main className="mx-auto w-full max-w-2xl px-4 pt-8 pb-28 md:pb-8">{children}</main>
    </div>
  );
}

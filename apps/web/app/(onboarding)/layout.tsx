import type { ReactNode } from 'react';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/server/services/auth';

// D8: onboarding needs a signed-in user. PRD §6.2: the steps have no app navigation; Back, Skip and Next lead the
// way, and the app opens once the programme is started.
export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  if (!(await getCurrentUser(await createSupabaseServerClient()))) await redirectToLogin();
  return <main className="mx-auto w-full max-w-xl px-4 pt-8 pb-12">{children}</main>;
}

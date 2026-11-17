import type { ReactNode } from 'react';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/server/services/auth';

// D8: the workout needs a signed-in user, like every app route. PRD §9 "no accidental exits": the workout is
// full screen, with no app navigation; its only way out is the Leave dialog.
export default async function WorkoutLayout({ children }: { children: ReactNode }) {
  if (!(await getCurrentUser(await createSupabaseServerClient()))) await redirectToLogin();
  return <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-32">{children}</main>;
}

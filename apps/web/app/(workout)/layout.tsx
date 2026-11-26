import type { ReactNode } from 'react';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { SyncProvider } from '@/lib/offline/sync-provider';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/server/services/auth';

// D8: the workout needs a signed-in user, like every app route. PRD §9 "no accidental exits": the workout is
// full screen, with no app navigation; its only way out is the Leave dialog. Its writes go through the user's outbox
// (P4-05, D89).
export default async function WorkoutLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser(await createSupabaseServerClient());
  if (!user) return redirectToLogin();
  return (
    <SyncProvider userId={user.id}>
      <main className="mx-auto w-full max-w-2xl px-4 pt-4 pb-32">{children}</main>
    </SyncProvider>
  );
}

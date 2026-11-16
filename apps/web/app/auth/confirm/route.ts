import { type NextRequest, NextResponse } from 'next/server';
import { HOME_PATH, LOGIN_PATH, UPDATE_PASSWORD_PATH } from '@/lib/auth/paths';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isEmailLinkType, verifyEmailLink } from '@/server/services/auth';

// The link in the confirmation and password-reset emails (supabase/templates/*.html).
// A confirmed email lands on the home page; a reset link leads to choosing a new password.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const type = params.get('type');
  const target = request.nextUrl.clone();
  target.search = '';

  const result = isEmailLinkType(type)
    ? await verifyEmailLink(await createSupabaseServerClient(), type, params.get('token_hash'))
    : ({ ok: false } as const);

  if (result.ok) {
    target.pathname = type === 'recovery' ? UPDATE_PASSWORD_PATH : HOME_PATH;
  } else {
    target.pathname = LOGIN_PATH;
    target.searchParams.set('error', 'link');
  }
  return NextResponse.redirect(target);
}

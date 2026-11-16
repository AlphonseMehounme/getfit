import { type NextRequest, NextResponse } from 'next/server';
import { HOME_PATH, LOGIN_PATH } from '@/lib/auth/paths';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { confirmEmail } from '@/server/services/auth';

// The link in the confirmation email (supabase/templates/confirmation.html). Verifying the token hash
// works on any device or browser, unlike a PKCE code, which needs the browser that signed up.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const target = request.nextUrl.clone();
  target.search = '';

  const result =
    params.get('type') === 'email'
      ? await confirmEmail(await createSupabaseServerClient(), params.get('token_hash'))
      : ({ ok: false } as const);

  if (result.ok) {
    target.pathname = HOME_PATH;
  } else {
    target.pathname = LOGIN_PATH;
    target.searchParams.set('error', 'link');
  }
  return NextResponse.redirect(target);
}

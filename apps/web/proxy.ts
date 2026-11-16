import { createServerClient } from '@supabase/ssr';
import { type NextRequest, NextResponse } from 'next/server';
import { isPublicPath, loginUrlFor, PATHNAME_HEADER } from '@/lib/auth/paths';
import { supabaseEnv } from '@/lib/supabase/env';

// Runs before anything renders: refreshes the Supabase session cookie and keeps anonymous visitors
// out of every non-public route (D8, deny by default). Layouts and pages check the user again,
// because Next renders a page and its layout in parallel.
export async function proxy(request: NextRequest) {
  request.headers.set(PATHNAME_HEADER, `${request.nextUrl.pathname}${request.nextUrl.search}`);
  let response = NextResponse.next({ request });
  const { url, publishableKey } = supabaseEnv();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  if (!data?.claims && !isPublicPath(request.nextUrl.pathname)) {
    const login = new URL(
      loginUrlFor(`${request.nextUrl.pathname}${request.nextUrl.search}`),
      request.url,
    );
    return NextResponse.redirect(login);
  }
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|media/|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)',
  ],
};

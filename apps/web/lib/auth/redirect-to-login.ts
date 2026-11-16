import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { HOME_PATH, loginUrlFor, PATHNAME_HEADER } from './paths';
import { safeNextPath } from './safe-next-path';

/** Sends an anonymous visitor to the login page, remembering the page they asked for. */
export async function redirectToLogin(): Promise<never> {
  redirect(loginUrlFor(safeNextPath((await headers()).get(PATHNAME_HEADER), HOME_PATH)));
}

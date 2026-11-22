import { describe, expect, it } from 'vitest';
import { isPublicPath, loginUrlFor } from './paths';

describe('isPublicPath (D8: deny by default)', () => {
  it.each([
    '/',
    '/login',
    '/sign-up',
    '/reset-password',
    '/auth/confirm',
    // D95: the offline page, the manifest and the service worker load without a session.
    '/offline',
    '/manifest.webmanifest',
    '/serwist/sw.js',
  ])('%s is public', (path) => {
    expect(isPublicPath(path)).toBe(true);
  });

  it.each([
    '/profile',
    '/update-password',
    '/today',
    '/login/extra',
    '/authx',
    '/sign-up-later',
    '/offline/x',
    '/serwistx',
  ])('%s needs a session', (path) => {
    expect(isPublicPath(path)).toBe(false);
  });
});

it('builds a login URL that returns to the requested page', () => {
  expect(loginUrlFor('/profile?tab=1')).toBe('/login?next=%2Fprofile%3Ftab%3D1');
});

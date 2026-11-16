import { describe, expect, it } from 'vitest';
import { HOME_PATH } from './paths';
import { safeNextPath } from './safe-next-path';

describe('safeNextPath', () => {
  it.each(['/profile', '/profile?tab=account', '/today#week'])(
    'keeps the local path %s',
    (path) => {
      expect(safeNextPath(path)).toBe(path);
    },
  );

  it.each([
    undefined,
    null,
    42,
    '',
    'profile',
    '//evil.example',
    '/\\evil.example',
    'https://evil.example/profile',
    'javascript:alert(1)',
    '/profile\nSet-Cookie: x',
  ])('falls back to the home path for %j', (value) => {
    expect(safeNextPath(value)).toBe(HOME_PATH);
  });

  it('uses the given fallback', () => {
    expect(safeNextPath('//evil.example', '/login')).toBe('/login');
  });
});

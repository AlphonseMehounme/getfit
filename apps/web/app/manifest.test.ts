import { describe, expect, it, vi } from 'vitest';
import { BRAND_COLOURS } from '@/lib/design/brand';
import en from '../messages/en.json';

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: 'title' | 'description') => en.Metadata[key],
}));

const { default: manifest } = await import('./manifest');

describe('the PWA manifest (D95, PRD §12)', () => {
  it('is installable: standalone from Today, cobalt, with any and maskable icons', async () => {
    const m = await manifest();
    expect(m).toMatchObject({
      name: 'GetFit',
      short_name: 'GetFit',
      start_url: '/today',
      scope: '/',
      display: 'standalone',
      background_color: BRAND_COLOURS.backgroundLight,
      theme_color: BRAND_COLOURS.accent,
    });
    expect(m.icons?.map((i) => [i.sizes, i.purpose])).toEqual([
      ['192x192', 'any'],
      ['512x512', 'any'],
      ['512x512', 'maskable'],
    ]);
  });
});

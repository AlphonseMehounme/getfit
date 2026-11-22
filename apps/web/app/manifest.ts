import type { MetadataRoute } from 'next';
import { getTranslations } from 'next-intl/server';
import { BRAND_COLOURS } from '@/lib/design/brand';

// D95 / PRD §12: installable on mobile and desktop. Cobalt is the brand accent (D16); the background matches the
// light theme's.
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const t = await getTranslations('Metadata');
  return {
    name: t('title'),
    short_name: t('title'),
    description: t('description'),
    start_url: '/today',
    scope: '/',
    display: 'standalone',
    background_color: BRAND_COLOURS.backgroundLight,
    theme_color: BRAND_COLOURS.accent,
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

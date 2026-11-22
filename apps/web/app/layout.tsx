import type { Metadata, Viewport } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { ServiceWorker } from '@/components/layout/service-worker';
import { BRAND_COLOURS } from '@/lib/design/brand';
import { parseTheme, THEME_COOKIE, themeAttribute } from '@/lib/theme';
import './globals.css';

// PRD §9: Inter, self-hosted by next/font at build time.
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return {
    title: t('title'),
    description: t('description'),
    // D95: installable, with its own icon on iOS.
    appleWebApp: { capable: true, title: t('title'), statusBarStyle: 'default' },
    icons: { apple: '/icons/apple-touch-icon.png' },
  };
}

/** D95: the browser chrome follows the theme's background. */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: BRAND_COLOURS.backgroundLight },
    { media: '(prefers-color-scheme: dark)', color: BRAND_COLOURS.backgroundDark },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  // D56: the device's theme, rendered on the server so there is no flash.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html lang={locale} className={inter.variable} data-theme={themeAttribute(theme)}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider>
          <ServiceWorker>{children}</ServiceWorker>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

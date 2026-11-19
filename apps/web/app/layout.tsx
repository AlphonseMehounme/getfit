import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { cookies } from 'next/headers';
import { Inter } from 'next/font/google';
import type { ReactNode } from 'react';
import { parseTheme, THEME_COOKIE, themeAttribute } from '@/lib/theme';
import './globals.css';

// PRD §9: Inter, self-hosted by next/font at build time.
const inter = Inter({ subsets: ['latin'], display: 'swap', variable: '--font-inter' });

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Metadata');
  return { title: t('title'), description: t('description') };
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  // D56: the device's theme, rendered on the server so there is no flash.
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html lang={locale} className={inter.variable} data-theme={themeAttribute(theme)}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}

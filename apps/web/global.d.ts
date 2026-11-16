import type messages from './messages/fr.json';
import type { Locale } from './lib/i18n/config';

// Typed message keys and locales for next-intl (ADR 0003). French is the source catalogue.
declare module 'next-intl' {
  interface AppConfig {
    Locale: Locale;
    Messages: typeof messages;
  }
}

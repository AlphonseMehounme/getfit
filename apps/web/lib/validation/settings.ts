import { z } from 'zod';
import { locales } from '@/lib/i18n/config';
import { THEMES } from '@/lib/theme';

// D35 / D15 / D56: the Profile preferences. The language is saved on the account; the theme stays on the device.

export const preferencesSchema = z.strictObject({
  locale: z.enum(locales),
  theme: z.enum(THEMES),
});

export type PreferencesInput = z.input<typeof preferencesSchema>;

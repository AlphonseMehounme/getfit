'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { StepShell } from '@/components/onboarding/step-shell';
import { Selector } from '@/components/ui/selector';
import { PROFILE_PATH } from '@/lib/auth/paths';
import { locales, type Locale } from '@/lib/i18n/config';
import { schemaResolver } from '@/lib/onboarding/schema-resolver';
import type { StepActionResult } from '@/lib/onboarding/use-step-submit';
import { THEMES, type Theme } from '@/lib/theme';
import { preferencesSchema } from '@/lib/validation/settings';

// D35: the language (D15, the account's) and the theme (D56, this device's), checked with the server's schema
// (AGENTS §2). A successful save redirects to Profile, so only a failure comes back here.

interface Values {
  locale: Locale;
  theme: Theme;
}

export function PreferencesForm({
  locale,
  theme,
  save,
}: {
  locale: Locale;
  theme: Theme;
  save: (values: unknown) => Promise<StepActionResult>;
}) {
  const t = useTranslations('Profile');
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();
  const { register, handleSubmit } = useForm<Values>({
    resolver: schemaResolver(preferencesSchema),
    defaultValues: { locale, theme },
  });
  const onValid = (values: Values) => {
    setFailed(false);
    startTransition(async () => {
      if ((await save(values))?.ok === false) setFailed(true);
    });
  };

  return (
    <StepShell
      mode="settings"
      current={0}
      total={0}
      isLast={false}
      backHref={PROFILE_PATH}
      pending={pending}
      failed={failed}
      title={t('sections.preferences')}
      intro={t('preferences.intro')}
      onSubmit={handleSubmit(onValid)}
    >
      <Selector
        legend={t('language')}
        type="radio"
        columns={2}
        options={locales.map((value) => ({ value, label: t(`languages.${value}`) }))}
        defaultValues={[locale]}
        {...register('locale')}
      />
      <Selector
        legend={t('fields.theme')}
        hint={t('preferences.themeHint')}
        type="radio"
        options={THEMES.map((value) => ({ value, label: t(`themes.${value}`) }))}
        defaultValues={[theme]}
        {...register('theme')}
      />
    </StepShell>
  );
}

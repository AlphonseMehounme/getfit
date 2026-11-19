import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { StepForm } from '@/components/onboarding/step-form';
import { PreferencesForm } from '@/components/profile/preferences-form';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { isSettingsSection } from '@/lib/profile/sections';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { parseTheme, THEME_COOKIE } from '@/lib/theme';
import { getRequestClock } from '@/server/request-clock';
import { getOnboarding } from '@/server/services/onboarding';
import { backToProfileAction, savePreferencesAction, saveSettingsStepAction } from '../../actions';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  if (!isSettingsSection(section)) return {};
  const t = await getTranslations('Profile.sections');
  return { title: t(section) };
}

const actions = {
  save: saveSettingsStepAction,
  finish: backToProfileAction,
  mode: 'settings' as const,
};

// D35: one Profile section, edited with the same form as its onboarding step, or the preferences.
export default async function EditProfileSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!isSettingsSection(section)) notFound();
  const view = await getOnboarding(await createSupabaseServerClient());
  if (!view) return redirectToLogin();

  if (section === 'preferences') {
    return (
      <PreferencesForm
        locale={view.profile.locale}
        theme={parseTheme((await cookies()).get(THEME_COOKIE)?.value)}
        save={savePreferencesAction}
      />
    );
  }
  return (
    <StepForm
      step={section}
      view={view}
      currentYear={(await getRequestClock()).now().getUTCFullYear()}
      actions={actions}
    />
  );
}

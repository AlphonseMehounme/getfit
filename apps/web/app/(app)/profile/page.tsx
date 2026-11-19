import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import {
  AboutSummary,
  EquipmentSummary,
  ExperienceSummary,
  GoalsSummary,
  WeekSummary,
} from '@/components/profile/answers-summary';
import { BaselinesSummary } from '@/components/profile/baselines-summary';
import { Field, ProfileSection } from '@/components/profile/profile-section';
import { Button } from '@/components/ui/button';
import { Notice } from '@/components/ui/notice';
import { redirectToLogin } from '@/lib/auth/redirect-to-login';
import { savedBaselinesOf } from '@/lib/onboarding/saved-baselines';
import { editPath, savedSection, type SettingsSection } from '@/lib/profile/sections';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { parseTheme, THEME_COOKIE } from '@/lib/theme';
import { getAccount } from '@/server/services/account';
import { getOnboarding } from '@/server/services/onboarding';
import { signOutAction } from './actions';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Profile');
  return { title: t('title') };
}

// D35: every onboarding answer and the preferences, each with a link to edit it. Export and account deletion come
// in Phase 4, so nothing is shown for them yet (no dead buttons, AGENTS §9).
export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string | string[] }>;
}) {
  const t = await getTranslations('Profile');
  // Pages render in parallel with their layout, so each protected page checks the session itself.
  const client = await createSupabaseServerClient();
  const [account, view] = await Promise.all([getAccount(client), getOnboarding(client)]);
  if (!account || !view) return redirectToLogin();
  const saved = savedSection((await searchParams).saved);
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);
  const { profile } = view;

  /** "Answer now" for a step never answered (D35), "Edit" otherwise. */
  const edit = (section: SettingsSection, answered: boolean) => {
    const name = t(`sections.${section}`);
    return {
      id: section,
      title: name,
      editHref: editPath(section),
      editLabel: answered ? t('edit') : t('answer'),
      editName: answered
        ? t('editSection', { section: name })
        : t('answerSection', { section: name }),
    };
  };
  const baselines = savedBaselinesOf(view.baselines);
  const hasBaselines = Object.values(baselines).some((value) => value !== null);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-3xl font-semibold tracking-tight">{t('title')}</h1>
      {saved ? (
        <Notice tone="info" title={t('saved')} live>
          {t('savedBody', { section: t(`sections.${saved}`) })}
        </Notice>
      ) : null}
      <ProfileSection {...edit('profile', true)}>
        <AboutSummary profile={profile} />
      </ProfileSection>
      <ProfileSection {...edit('goals', view.goals.length > 0)}>
        <GoalsSummary goals={view.goals} />
      </ProfileSection>
      <ProfileSection {...edit('experience', profile.experience_level !== null)}>
        <ExperienceSummary experience={profile.experience_level} />
      </ProfileSection>
      <ProfileSection {...edit('equipment', view.equipment.length > 0)}>
        <EquipmentSummary equipment={view.equipment} />
      </ProfileSection>
      <ProfileSection
        {...edit(
          'availability',
          Object.keys(view.availability).length > 0 || profile.preferred_duration_min !== null,
        )}
      >
        <WeekSummary
          availability={view.availability}
          preferredDurationMin={profile.preferred_duration_min}
        />
      </ProfileSection>
      <ProfileSection {...edit('baselines', hasBaselines)}>
        <BaselinesSummary saved={baselines} units={profile.preferred_units} />
      </ProfileSection>
      <ProfileSection {...edit('preferences', true)}>
        <dl className="grid gap-3 sm:grid-cols-2">
          <Field label={t('language')}>{t(`languages.${profile.locale}`)}</Field>
          <Field label={t('fields.theme')}>{t(`themes.${theme}`)}</Field>
        </dl>
      </ProfileSection>
      <ProfileSection id="account" title={t('account')}>
        <dl className="grid gap-3">
          <Field label={t('email')}>
            <span className="break-all">{account.email ?? '—'}</span>
          </Field>
        </dl>
        <form action={signOutAction}>
          <Button type="submit" variant="secondary">
            {t('signOut')}
          </Button>
        </form>
      </ProfileSection>
    </div>
  );
}

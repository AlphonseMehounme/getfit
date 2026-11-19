import { PROFILE_PATH } from '@/lib/auth/paths';
import { isOnboardingStep, ONBOARDING_STEPS } from '@/lib/onboarding/steps';

// D35: Profile edits every onboarding step, plus the preferences (language and theme).

export const SETTINGS_SECTIONS = [...ONBOARDING_STEPS, 'preferences'] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export const isSettingsSection = (value: string): value is SettingsSection =>
  value === 'preferences' || isOnboardingStep(value);

export const editPath = (section: SettingsSection) => `${PROFILE_PATH}/edit/${section}`;

/** The section named by `?saved=`, if it is one. */
export const savedSection = (value: string | string[] | undefined): SettingsSection | null =>
  typeof value === 'string' && isSettingsSection(value) ? value : null;

import {
  type Availability,
  availabilityMismatches,
  type Clock,
  heightToCm,
  type IsoWeekday,
  missingEquipment,
  programmeAvailability,
  skippedSteps,
} from '@getfit/domain';
import { type Track, track } from '@/lib/observability/analytics';
import {
  availabilityStepSchema,
  baselinesStepSchema,
  equipmentStepSchema,
  experienceStepSchema,
  goalsStepSchema,
  profileStepSchema,
} from '@/lib/validation/onboarding';
import { LAUNCH_PROGRAMME_SLUG } from '@/server/config/programme';
import type { DbClient } from '@/server/db/client';
import { type Baselines, findBaselines } from '@/server/repositories/baselines';
import {
  type EquipmentType,
  findAvailability,
  findGoals,
  type GoalType,
  replaceAvailability,
  replaceEquipment,
  replaceGoals,
} from '@/server/repositories/preferences';
import { findRequiredEquipment, findProgramme } from '@/server/repositories/programme';
import {
  findOnboardingProfile,
  findUserEquipment,
  markOnboardingCompleted,
  type OnboardingProfile,
  updateProfile,
} from '@/server/repositories/profiles';
import { getCurrentUser } from './auth';
import { saveBaselines } from './onboarding-baselines';

// PRD §6.2: six steps; only step 1 is required, and every later step can be skipped and finished from Settings
// (D35). Each step is saved on its own and replaces its previous answers.

export type OnboardingStep =
  'profile' | 'goals' | 'experience' | 'equipment' | 'availability' | 'baselines';

export type SaveStepResult = { ok: true } | { ok: false; error: 'invalid_input' | 'not_signed_in' };

interface Schema<T> {
  safeParse(input: unknown): { success: true; data: T } | { success: false };
}

/** Validates with the step's schema (the same as the form's, AGENTS §2), then saves for the signed-in user. */
async function run<T>(
  client: DbClient,
  schema: Schema<T>,
  input: unknown,
  save: (userId: string, data: T) => Promise<{ ok: boolean } | void>,
): Promise<SaveStepResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: 'invalid_input' };
  const user = await getCurrentUser(client);
  if (!user) return { ok: false, error: 'not_signed_in' };
  const saved = await save(user.id, parsed.data);
  // A value the database refused as its last line (e.g. an unknown time zone) is invalid input too.
  return saved && !saved.ok ? { ok: false, error: 'invalid_input' } : { ok: true };
}

export function saveOnboardingStep(
  client: DbClient,
  step: OnboardingStep,
  input: unknown,
  clock: Clock,
): Promise<SaveStepResult> {
  switch (step) {
    case 'profile':
      return run(client, profileStepSchema(clock.now().getUTCFullYear()), input, (userId, p) =>
        updateProfile(client, userId, {
          first_name: p.firstName,
          birth_year: p.birthYear,
          height_cm: p.height === null ? null : heightToCm(p.height, p.heightUnit),
          preferred_units: p.units,
          timezone: p.timezone,
        }),
      );
    case 'goals':
      return run(client, goalsStepSchema, input, (userId, g) =>
        replaceGoals(client, userId, g.goals),
      );
    case 'experience':
      return run(client, experienceStepSchema, input, (userId, e) =>
        updateProfile(client, userId, { experience_level: e.experience }),
      );
    case 'equipment':
      return run(client, equipmentStepSchema, input, (userId, e) =>
        replaceEquipment(client, userId, e.equipment),
      );
    case 'availability':
      return run(client, availabilityStepSchema, input, async (userId, a) => {
        await replaceAvailability(client, userId, a.days as Availability);
        return updateProfile(client, userId, { preferred_duration_min: a.preferredDurationMin });
      });
    case 'baselines':
      return run(client, baselinesStepSchema, input, async (userId, b) => {
        const profile = await findOnboardingProfile(client, userId);
        if (!profile) throw new Error('profile missing for signed-in user');
        await saveBaselines(client, { id: userId, timezone: profile.timezone }, b, clock.now());
      });
  }
}

export interface OnboardingView {
  profile: OnboardingProfile;
  goals: GoalType[];
  equipment: EquipmentType[];
  availability: Availability;
  baselines: Baselines;
  /** PRD §6.2 AC: the programme's equipment the user lacks (D42). */
  missingEquipment: EquipmentType[];
  /** D36: step 5's pre-fill, and the answered days that differ from it. */
  programmeAvailability: Availability;
  availabilityMismatches: IsoWeekday[];
}

/** Every saved answer, to pre-fill the steps (and Settings, D35). Null when nobody is signed in. */
export async function getOnboarding(client: DbClient): Promise<OnboardingView | null> {
  const user = await getCurrentUser(client);
  return user ? loadOnboarding(client, user.id) : null;
}

async function loadOnboarding(client: DbClient, userId: string): Promise<OnboardingView> {
  const profile = await findOnboardingProfile(client, userId);
  if (!profile) throw new Error('profile missing for signed-in user');
  const programme = await findProgramme(client, { slug: LAUNCH_PROGRAMME_SLUG }, profile.locale);
  if (!programme) throw new Error('content: launch programme not published');
  const [goals, equipment, availability, baselines, required] = await Promise.all([
    findGoals(client, userId),
    findUserEquipment(client, userId),
    findAvailability(client, userId),
    findBaselines(client, userId),
    findRequiredEquipment(client, programme.id),
  ]);
  const prefill = programmeAvailability(programme.shape);
  return {
    profile,
    goals,
    equipment,
    availability,
    baselines,
    missingEquipment: missingEquipment(equipment, required),
    programmeAvailability: prefill,
    availabilityMismatches: availabilityMismatches(availability, prefill),
  };
}

export type CompleteResult =
  { ok: true; completed: boolean } | { ok: false; error: 'not_signed_in' | 'step1_required' };

/**
 * Ends onboarding once (D53): a second call changes nothing and sends no event. Step 1's first name is required
 * (PRD §6.2); every later step may be skipped. The event carries only the skipped-step count (AGENTS §12).
 */
export async function completeOnboarding(
  client: DbClient,
  clock: Clock,
  trackEvent: Track = track,
): Promise<CompleteResult> {
  const user = await getCurrentUser(client);
  if (!user) return { ok: false, error: 'not_signed_in' };
  const view = await loadOnboarding(client, user.id);
  if (!view.profile.first_name) return { ok: false, error: 'step1_required' };
  const changed = await markOnboardingCompleted(client, user.id, clock.now());
  if (changed) {
    const { baselines } = view;
    const skipped = skippedSteps({
      goals: view.goals.length,
      experience: view.profile.experience_level !== null,
      equipment: view.equipment.length,
      availability:
        Object.keys(view.availability).length + (view.profile.preferred_duration_min ? 1 : 0),
      baselines:
        (baselines.weight ? 1 : 0) + Object.keys(baselines.tests).length + (baselines.run ? 1 : 0),
    });
    await trackEvent(
      { name: 'onboarding_completed', properties: { skipped_steps: skipped } },
      user.id,
    );
  }
  return { ok: true, completed: changed };
}

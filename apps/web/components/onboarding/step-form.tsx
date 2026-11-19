import type { StepActions } from '@/lib/onboarding/use-step-submit';
import type { OnboardingStepSlug } from '@/lib/onboarding/steps';
import { savedBaselinesOf } from '@/lib/onboarding/saved-baselines';
import type { OnboardingView } from '@/server/services/onboarding';
import { AvailabilityStep } from './availability-step';
import { BaselinesStep } from './baselines-step';
import { ChoiceStep } from './choice-step';
import { ProfileStep } from './profile-step';

// PRD §6.2 / D35: one form per onboarding step, pre-filled with what was saved (D55). The same forms edit the answers
// from Profile, so a step is saved and checked the same way in both places.

/** Every IANA zone the runtime knows, with the saved one kept even if the list lacks it (e.g. UTC). */
function timeZoneList(saved: string): string[] {
  const zones = new Set(Intl.supportedValuesOf('timeZone'));
  zones.add(saved);
  return [...zones].sort();
}

export function StepForm({
  step,
  view,
  currentYear,
  actions,
}: {
  step: OnboardingStepSlug;
  view: OnboardingView;
  currentYear: number;
  actions: StepActions;
}) {
  const { profile } = view;
  switch (step) {
    case 'profile':
      return (
        <ProfileStep
          answers={{
            firstName: profile.first_name,
            birthYear: profile.birth_year,
            heightCm: profile.height_cm === null ? null : Number(profile.height_cm),
            units: profile.preferred_units,
            timezone: profile.timezone,
          }}
          currentYear={currentYear}
          timeZones={timeZoneList(profile.timezone)}
          actions={actions}
        />
      );
    case 'goals':
      return <ChoiceStep step="goals" answer={view.goals} actions={actions} />;
    case 'experience':
      return <ChoiceStep step="experience" answer={profile.experience_level} actions={actions} />;
    case 'equipment':
      return <ChoiceStep step="equipment" answer={view.equipment} actions={actions} />;
    case 'availability':
      return (
        <AvailabilityStep
          // D36: pre-filled with the programme's days until the user saves their own.
          answer={
            Object.keys(view.availability).length > 0
              ? view.availability
              : view.programmeAvailability
          }
          preferredDurationMin={profile.preferred_duration_min}
          actions={actions}
        />
      );
    case 'baselines':
      return (
        <BaselinesStep
          saved={savedBaselinesOf(view.baselines)}
          units={profile.preferred_units}
          actions={actions}
        />
      );
  }
}

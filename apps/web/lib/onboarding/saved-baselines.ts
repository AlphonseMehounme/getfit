import type { OnboardingView } from '@/server/services/onboarding';
import type { SavedBaselines } from './baselines-form';

type Baselines = OnboardingView['baselines'];

/** Step 6's saved baselines as values and IDs only, for the form and the Profile summary (BR-26, D51). */
export function savedBaselinesOf(baselines: Baselines): SavedBaselines {
  const test = (type: keyof Baselines['tests']) => {
    const record = baselines.tests[type];
    return record ? { id: record.id, value: record.value } : null;
  };
  const { weight, run } = baselines;
  return {
    weight: weight ? { id: weight.id, weightKg: weight.weightKg } : null,
    maxPullUps: test('max_pull_ups'),
    maxPushUps: test('max_push_ups'),
    maxSquats: test('max_squats'),
    run: run
      ? { id: run.id, distanceM: run.distanceM, durationS: run.durationS, rpe: run.rpe }
      : null,
  };
}

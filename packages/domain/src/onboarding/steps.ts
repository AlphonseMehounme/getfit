// PRD §6.2: only step 1 is required; steps 2–6 can be skipped and finished from Settings.

/** What is saved for each optional step, as counts or presence. */
export interface OnboardingAnswers {
  goals: number;
  experience: boolean;
  equipment: number;
  /** Answered weekdays, or a preferred duration. */
  availability: number;
  baselines: number;
}

/**
 * The `skipped_steps` count of `onboarding_completed`: optional steps (2–6) with nothing saved.
 * Derived from the stored answers, so no "skipped" flag is ever stored.
 */
export function skippedSteps(answers: OnboardingAnswers): number {
  return [
    answers.goals > 0,
    answers.experience,
    answers.equipment > 0,
    answers.availability > 0,
    answers.baselines > 0,
  ].filter((answered) => !answered).length;
}

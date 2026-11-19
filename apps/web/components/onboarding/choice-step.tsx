'use client';

import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { Selector } from '@/components/ui/selector';
import { schemaResolver } from '@/lib/onboarding/schema-resolver';
import { type StepActions, useStepSubmit } from '@/lib/onboarding/use-step-submit';
import {
  EQUIPMENT_TYPES,
  equipmentStepSchema,
  EXPERIENCE_LEVELS,
  experienceStepSchema,
  GOAL_TYPES,
  goalsStepSchema,
} from '@/lib/validation/onboarding';
import { StepShell } from './step-shell';

// PRD §6.2 steps 2–4: goals (several), experience (one) and equipment (several), each one selector, checked with
// the server's schema (AGENTS §2). Choosing nothing and pressing Next saves "nothing", like Skip.

const CONFIG = {
  goals: { schema: goalsStepSchema, type: 'checkbox', columns: 2 },
  experience: { schema: experienceStepSchema, type: 'radio', columns: 1 },
  equipment: { schema: equipmentStepSchema, type: 'checkbox', columns: 2 },
} as const;

export type ChoiceStepSlug = keyof typeof CONFIG;
interface Values {
  goals?: string[];
  experience?: string | null;
  equipment?: string[];
}

function useOptions(step: ChoiceStepSlug) {
  const t = useTranslations('Onboarding');
  switch (step) {
    case 'goals':
      return GOAL_TYPES.map((value) => ({ value, label: t(`goals.options.${value}`) }));
    case 'equipment':
      return EQUIPMENT_TYPES.map((value) => ({ value, label: t(`equipment.options.${value}`) }));
    case 'experience':
      return EXPERIENCE_LEVELS.map((value) => ({
        value,
        label: t(`experience.options.${value}`),
        description: t(`experience.hints.${value}`),
      }));
  }
}

export function ChoiceStep({
  step,
  answer,
  actions,
}: {
  step: ChoiceStepSlug;
  /** The saved answer: a list for goals and equipment, one value or null for experience. */
  answer: readonly string[] | string | null;
  actions: StepActions;
}) {
  const t = useTranslations('Onboarding');
  const config = CONFIG[step];
  const options = useOptions(step);
  const { submit, shell } = useStepSubmit(step, actions);
  const { register, handleSubmit } = useForm<Values>({
    resolver: schemaResolver(config.schema),
    defaultValues:
      step === 'experience'
        ? { experience: typeof answer === 'string' ? answer : null }
        : { [step]: Array.isArray(answer) ? [...answer] : [] },
  });

  return (
    <StepShell
      {...shell}
      title={t(`${step}.title`)}
      intro={t(`${step}.intro`)}
      onSubmit={handleSubmit(submit)}
    >
      <Selector
        legend={t(`${step}.legend`)}
        type={config.type}
        columns={config.columns}
        options={options}
        defaultValues={Array.isArray(answer) ? answer : typeof answer === 'string' ? [answer] : []}
        {...register(step)}
      />
    </StepShell>
  );
}

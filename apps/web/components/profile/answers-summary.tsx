import { type Availability, cmToFeetInches } from '@getfit/domain';
import { useFormatter, useTranslations } from 'next-intl';
import { weekdayDate } from '@/lib/onboarding/weekday';
import type { OnboardingView } from '@/server/services/onboarding';
import { Field } from './profile-section';

type OnboardingProfile = OnboardingView['profile'];

// D35: what each onboarding step saved, as Profile shows it. Values are shown in the user's units, and an answer
// never given says so (PRD §6.2: every step after the first can be skipped).

export function AboutSummary({ profile }: { profile: OnboardingProfile }) {
  const t = useTranslations();
  const height = () => {
    if (profile.height_cm === null) return '—';
    const cm = Number(profile.height_cm);
    if (profile.preferred_units === 'metric') return t('Profile.heightCm', { cm });
    return t('Profile.heightFtIn', cmToFeetInches(cm));
  };
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      <Field label={t('Profile.fields.firstName')}>{profile.first_name ?? '—'}</Field>
      <Field label={t('Profile.fields.birthYear')}>{profile.birth_year ?? '—'}</Field>
      <Field label={t('Profile.fields.height')}>{height()}</Field>
      <Field label={t('Profile.fields.units')}>
        {t(`Onboarding.profile.${profile.preferred_units}`)}
      </Field>
      <Field label={t('Profile.timeZone')}>{profile.timezone.replaceAll('_', ' ')}</Field>
    </dl>
  );
}

function NotAnswered() {
  const t = useTranslations('Profile');
  return <p className="text-muted">{t('notAnswered')}</p>;
}

export function GoalsSummary({ goals }: { goals: OnboardingView['goals'] }) {
  const t = useTranslations('Onboarding.goals.options');
  const format = useFormatter();
  if (goals.length === 0) return <NotAnswered />;
  return <p>{format.list(goals.map((goal) => t(goal)))}</p>;
}

export function ExperienceSummary({
  experience,
}: {
  experience: OnboardingProfile['experience_level'];
}) {
  const t = useTranslations('Onboarding.experience.options');
  return experience ? <p>{t(experience)}</p> : <NotAnswered />;
}

export function EquipmentSummary({ equipment }: { equipment: OnboardingView['equipment'] }) {
  const t = useTranslations('Onboarding.equipment.options');
  const format = useFormatter();
  if (equipment.length === 0) return <NotAnswered />;
  return <p>{format.list(equipment.map((item) => t(item)))}</p>;
}

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;

export function WeekSummary({
  availability,
  preferredDurationMin,
}: {
  availability: Availability;
  preferredDurationMin: number | null;
}) {
  const t = useTranslations();
  const format = useFormatter();
  const days = WEEKDAYS.filter((day) => availability[day]);
  if (days.length === 0 && preferredDurationMin === null) return <NotAnswered />;
  return (
    <dl className="grid gap-3 sm:grid-cols-2">
      {days.map((day) => (
        <Field
          key={day}
          label={format.dateTime(weekdayDate(day), { weekday: 'long', timeZone: 'UTC' })}
        >
          {t(`Onboarding.availability.kinds.${availability[day]!}`)}
        </Field>
      ))}
      <Field label={t('Profile.fields.sessionLength')}>
        {preferredDurationMin === null
          ? '—'
          : t('Onboarding.availability.durationOption', { minutes: preferredDurationMin })}
      </Field>
    </dl>
  );
}

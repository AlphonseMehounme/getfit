import { getTranslations } from 'next-intl/server';

export default async function ProfileLoading() {
  const t = await getTranslations('Profile');
  return (
    <p role="status" className="text-muted">
      {t('loading')}
    </p>
  );
}

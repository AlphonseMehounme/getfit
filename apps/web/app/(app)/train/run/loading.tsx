import { getTranslations } from 'next-intl/server';

export default async function RunLoading() {
  const t = await getTranslations('Run');
  return (
    <p role="status" className="text-muted">
      {t('loading')}
    </p>
  );
}

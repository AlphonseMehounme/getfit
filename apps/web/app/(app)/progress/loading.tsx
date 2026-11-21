import { getTranslations } from 'next-intl/server';

export default async function ProgressLoading() {
  const t = await getTranslations('Progress');
  return (
    <p role="status" className="text-muted">
      {t('loading')}
    </p>
  );
}

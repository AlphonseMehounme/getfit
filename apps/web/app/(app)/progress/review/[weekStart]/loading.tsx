import { getTranslations } from 'next-intl/server';

export default async function ReviewLoading() {
  const t = await getTranslations('Review');
  return (
    <p role="status" className="text-muted">
      {t('loading')}
    </p>
  );
}

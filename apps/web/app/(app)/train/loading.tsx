import { getTranslations } from 'next-intl/server';

export default async function TrainLoading() {
  const t = await getTranslations('Train');
  return (
    <p role="status" className="text-muted">
      {t('loading')}
    </p>
  );
}

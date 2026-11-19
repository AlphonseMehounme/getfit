import { getTranslations } from 'next-intl/server';

export default async function ProgrammeLoading() {
  const t = await getTranslations('Programme');
  return (
    <p role="status" className="text-muted">
      {t('loading')}
    </p>
  );
}

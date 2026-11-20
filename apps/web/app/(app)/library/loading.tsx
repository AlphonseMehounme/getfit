import { getTranslations } from 'next-intl/server';

export default async function LibraryLoading() {
  const t = await getTranslations('Library');
  return (
    <p role="status" className="text-muted">
      {t('loading')}
    </p>
  );
}

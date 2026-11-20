import { Search } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { FormField } from '@/components/ui/form-field';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { LIBRARY_PATH } from '@/lib/auth/paths';
import type { LibraryView } from '@/server/services/library';

// PRD §6.7: search and filters as a plain GET form, so they work before the page is interactive and the address can
// be shared. The chosen values stay in the form.

type Filter = 'category' | 'equipment' | 'muscle' | 'difficulty';

export function LibraryFilters({ filters, options }: Pick<LibraryView, 'filters' | 'options'>) {
  const t = useTranslations();
  const label: Record<Filter, (value: string) => string> = {
    category: (v) => t(`Library.categories.${v as 'upper'}`),
    equipment: (v) => t(`Onboarding.equipment.options.${v as 'bodyweight'}`),
    muscle: (v) => t(`Library.muscles.${v as 'lats'}`),
    difficulty: (v) => t(`Library.difficulties.${v as 'beginner'}`),
  };
  const values: Record<Filter, string[]> = {
    category: options.categories,
    equipment: options.equipment,
    muscle: options.muscles,
    difficulty: options.difficulties,
  };
  const filtered = Object.values(filters).some(Boolean);

  return (
    <form method="get" action={LIBRARY_PATH} role="search" className="flex flex-col gap-4">
      <FormField
        label={t('Library.search')}
        hint={t('Library.searchHint')}
        name="query"
        type="search"
        defaultValue={filters.query ?? ''}
      />
      <div className="grid gap-3 sm:grid-cols-2">
        {(['category', 'equipment', 'muscle', 'difficulty'] as const).map((filter) => (
          <div key={filter} className="flex flex-col gap-2">
            <Label htmlFor={`library-${filter}`}>{t(`Library.${filter}`)}</Label>
            <Select id={`library-${filter}`} name={filter} defaultValue={filters[filter] ?? ''}>
              <option value="">{t('Library.any')}</option>
              {values[filter].map((value) => (
                <option key={value} value={value}>
                  {label[filter](value)}
                </option>
              ))}
            </Select>
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="submit"
          className="bg-accent text-accent-foreground hover:bg-accent-hover focus-visible:outline-focus rounded-control inline-flex min-h-12 items-center justify-center gap-2 px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Search aria-hidden="true" className="size-4" />
          {t('Library.apply')}
        </button>
        {filtered ? (
          <Link
            href={LIBRARY_PATH}
            className="border-control hover:bg-surface focus-visible:outline-focus rounded-control inline-flex min-h-12 items-center justify-center border px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {t('Library.clear')}
          </Link>
        ) : null}
      </div>
    </form>
  );
}

'use client';

import { CalendarDays, House, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AppNav, type NavItem } from '@/components/ui/app-nav';
import { HOME_PATH, PROFILE_PATH, PROGRAMME_PATH } from '@/lib/auth/paths';

// PRD §9 navigation: only destinations that exist are listed (AGENTS §9: no dead links).
// Train and Progress join as their screens ship. A client component, because icons are components
// and can't be passed from a server component.
export function MainNav() {
  const t = useTranslations('Nav');
  const items: NavItem[] = [
    { href: HOME_PATH, label: t('today'), icon: House },
    { href: PROGRAMME_PATH, label: t('programme'), icon: CalendarDays },
    { href: PROFILE_PATH, label: t('profile'), icon: User },
  ];
  return <AppNav items={items} />;
}

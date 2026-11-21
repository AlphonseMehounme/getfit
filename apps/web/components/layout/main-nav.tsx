'use client';

import { BookOpen, CalendarDays, ChartLine, Dumbbell, House, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AppNav, type NavItem } from '@/components/ui/app-nav';
import {
  HOME_PATH,
  LIBRARY_PATH,
  PROFILE_PATH,
  PROGRAMME_PATH,
  PROGRESS_PATH,
  TRAIN_PATH,
} from '@/lib/auth/paths';

// PRD §9 navigation: only destinations that exist are listed (AGENTS §9: no dead links).
// A client component, because icons are components
// and can't be passed from a server component.
export function MainNav() {
  const t = useTranslations('Nav');
  const items: NavItem[] = [
    { href: HOME_PATH, label: t('today'), icon: House },
    { href: PROGRAMME_PATH, label: t('programme'), icon: CalendarDays },
    // PRD §9: Train is the centre item.
    { href: TRAIN_PATH, label: t('train'), icon: Dumbbell },
    { href: PROGRESS_PATH, label: t('progress'), icon: ChartLine },
    // PRD §9: the library is in the desktop sidebar; on mobile it is reached from Train and Profile.
    { href: LIBRARY_PATH, label: t('library'), icon: BookOpen, desktopOnly: true },
    { href: PROFILE_PATH, label: t('profile'), icon: User },
  ];
  return <AppNav items={items} />;
}

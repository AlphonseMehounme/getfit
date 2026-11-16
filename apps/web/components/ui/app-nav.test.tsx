// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import { CalendarDays, House, User } from 'lucide-react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { AppNav, type NavItem } from './app-nav';

const pathname = vi.hoisted(() => ({ current: '/today' }));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.current }));

const ITEMS: NavItem[] = [
  { href: '/today', label: 'Home', icon: House },
  { href: '/programme', label: 'Programme', icon: CalendarDays },
  { href: '/profile', label: 'Profile', icon: User },
];

describe('AppNav', () => {
  beforeEach(() => {
    pathname.current = '/today';
  });

  it('PRD §9: a labelled navigation with only the destinations it is given', async () => {
    const { container } = renderWithIntl(<AppNav items={ITEMS} />);
    const nav = screen.getByRole('navigation', { name: 'Main navigation' });
    const links = within(nav).getAllByRole('link');
    expect(links.map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Home', '/today'],
      ['Programme', '/programme'],
      ['Profile', '/profile'],
    ]);
    // PRD §9: 48 px targets; bottom bar on mobile, sidebar from md.
    expect(links.every((l) => l.className.includes('min-h-12'))).toBe(true);
    expect(nav.className).toContain('fixed');
    expect(nav.className).toContain('md:static');
    await expectNoAxeViolations(container);
  });

  it('marks the current page, including its sub-pages', () => {
    pathname.current = '/programme/week/3';
    renderWithIntl(<AppNav items={ITEMS} />);
    const current = screen
      .getAllByRole('link')
      .filter((l) => l.getAttribute('aria-current') === 'page');
    expect(current.map((l) => l.textContent)).toEqual(['Programme']);
    expect(current[0]!.className).toContain('text-accent');
  });

  it('does not match a route that merely starts with the same letters', () => {
    pathname.current = '/profile-settings';
    renderWithIntl(<AppNav items={ITEMS} />);
    expect(screen.getAllByRole('link').some((l) => l.hasAttribute('aria-current'))).toBe(false);
  });

  it('D15: names the navigation in French', () => {
    renderWithIntl(<AppNav items={ITEMS.slice(0, 1)} />, 'fr');
    expect(screen.getByRole('navigation', { name: 'Navigation principale' })).toBeTruthy();
  });
});

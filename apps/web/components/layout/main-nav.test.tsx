// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { renderWithIntl } from '@/test/render';
import { MainNav } from './main-nav';

vi.mock('next/navigation', () => ({ usePathname: () => '/today' }));

describe('MainNav', () => {
  it('AGENTS §9: lists only the screens that exist, with Today current', () => {
    renderWithIntl(<MainNav />);
    const links = screen.getAllByRole('link');
    expect(links.map((l) => [l.textContent, l.getAttribute('href')])).toEqual([
      ['Today', '/today'],
      ['Programme', '/programme'],
      ['Profile', '/profile'],
    ]);
    expect(links[0]!.getAttribute('aria-current')).toBe('page');
  });
});

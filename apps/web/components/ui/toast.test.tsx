// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { TOAST_DURATION_MS, ToastProvider, useToast } from './toast';

function Trigger({ message, tone }: { message: string; tone?: 'success' | 'info' }) {
  const show = useToast();
  return (
    <button type="button" onClick={() => show(message, tone)}>
      Show
    </button>
  );
}

const renderToasts = (tone?: 'success' | 'info', locale: 'en' | 'fr' = 'en') =>
  renderWithIntl(
    <ToastProvider>
      <Trigger message="Session saved" tone={tone} />
    </ToastProvider>,
    locale,
  );

describe('Toast', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('WCAG 4.1.3: announces through a polite live region that is always present', async () => {
    const { container } = renderToasts('success');
    const region = screen.getByRole('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(region.textContent).toContain('Session saved');
    expect(region.querySelector('svg')!.getAttribute('class')).toContain('text-success');
    vi.useRealTimers();
    await expectNoAxeViolations(container);
  });

  it('dismisses itself after a few seconds', () => {
    renderToasts();
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 1));
    expect(screen.queryByText('Session saved')).not.toBeNull();
    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('Session saved')).toBeNull();
  });

  it('stays while hovered or focused, then resumes', () => {
    renderToasts();
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    const toast = screen.getByText('Session saved').parentElement!;
    fireEvent.mouseEnter(toast);
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS * 2));
    expect(screen.queryByText('Session saved')).not.toBeNull();
    fireEvent.mouseLeave(toast);
    fireEvent.focus(screen.getByRole('button', { name: 'Dismiss' }));
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS * 2));
    expect(screen.queryByText('Session saved')).not.toBeNull();
    fireEvent.blur(screen.getByRole('button', { name: 'Dismiss' }));
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS));
    expect(screen.queryByText('Session saved')).toBeNull();
  });

  it('can be dismissed by its button, and stacks several toasts', () => {
    renderToasts(undefined, 'fr');
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    fireEvent.click(screen.getByRole('button', { name: 'Show' }));
    expect(screen.getAllByText('Session saved')).toHaveLength(2);
    expect(screen.getAllByRole('status')[0]!.querySelector('svg')!.getAttribute('class')).toContain(
      'text-accent',
    );
    fireEvent.click(screen.getAllByRole('button', { name: 'Fermer la notification' })[0]!);
    expect(screen.getAllByText('Session saved')).toHaveLength(1);
  });

  it('refuses to work outside its provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Trigger message="x" />)).toThrow(
      'useToast must be used inside <ToastProvider>',
    );
  });
});

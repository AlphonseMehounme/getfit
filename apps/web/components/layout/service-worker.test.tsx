// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ServiceWorker } from './service-worker';

const provider = vi.fn();
vi.mock('@serwist/turbopack/react', () => ({
  SerwistProvider: ({ children, ...props }: { children: ReactNode }) => {
    provider(props);
    return <>{children}</>;
  },
}));

describe('ServiceWorker (D95)', () => {
  it('registers the worker, caching pages as they are visited, without reloading on reconnect', () => {
    render(
      <ServiceWorker>
        <p>page</p>
      </ServiceWorker>,
    );
    expect(screen.getByText('page')).toBeTruthy();
    expect(provider).toHaveBeenCalledWith({
      swUrl: '/serwist/sw.js',
      disable: false,
      cacheOnNavigation: true,
      reloadOnOnline: false,
    });
  });
});

it('is off under plain `next dev`, on when the tests ask for it', async () => {
  vi.resetModules();
  vi.stubEnv('NODE_ENV', 'development');
  const Off = (await import('./service-worker')).ServiceWorker;
  render(<Off>x</Off>);
  expect(provider).toHaveBeenLastCalledWith(expect.objectContaining({ disable: true }));
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_GETFIT_SERVICE_WORKER', 'on');
  const On = (await import('./service-worker')).ServiceWorker;
  render(<On>x</On>);
  expect(provider).toHaveBeenLastCalledWith(expect.objectContaining({ disable: false }));
  vi.unstubAllEnvs();
});

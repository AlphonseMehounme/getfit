// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { useHydrated } from './use-hydrated';

function Probe() {
  return <p>{useHydrated() ? 'interactive' : 'server'}</p>;
}

describe('useHydrated', () => {
  it('is false in the server render and true once mounted in the browser', () => {
    expect(renderToString(<Probe />)).toContain('server');
    render(<Probe />);
    expect(screen.getByText('interactive')).toBeTruthy();
  });
});

// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { Timer } from './timer';

describe('Timer', () => {
  it('PRD §9: a large countdown with a named timer role and a progress bar, axe clean', async () => {
    const { container } = renderWithIntl(
      <Timer label="Rest time left" remainingS={75} totalS={120} />,
    );
    const timer = screen.getByRole('timer', { name: 'Rest time left' });
    expect(timer.textContent).toBe('1:15');
    expect(timer.className).toContain('text-5xl');
    expect(timer.className).toContain('tabular-nums');
    const bar = screen.getByTestId('timer-progress');
    expect(bar.style.width).toBe('62.5%');
    // Reduced motion: the bar does not animate.
    expect(bar.className).toContain('motion-reduce:transition-none');
    await expectNoAxeViolations(container);
  });

  it('caps the bar at full and shows an empty bar without a length', () => {
    const { rerender } = renderWithIntl(<Timer label="t" remainingS={200} totalS={120} />);
    expect(screen.getByTestId('timer-progress').style.width).toBe('100%');
    rerender(<Timer label="t" remainingS={0} totalS={0} />);
    expect(screen.getByTestId('timer-progress').style.width).toBe('0%');
  });
});

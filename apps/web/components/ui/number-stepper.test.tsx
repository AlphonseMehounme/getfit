// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { NumberStepper } from './number-stepper';

function Harness({
  initial = 6,
  onChange = () => {},
}: {
  initial?: number;
  onChange?: (v: number) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <NumberStepper
      label="Reps"
      unit="reps"
      value={value}
      min={0}
      max={50}
      onChange={(v) => {
        setValue(v);
        onChange(v);
      }}
    />
  );
}

const spin = () => screen.getByRole('spinbutton', { name: 'Reps' });

describe('NumberStepper', () => {
  it('PRD §9: labelled controls with 48 px tap targets and a 32 px value', async () => {
    const { container } = renderWithIntl(<Harness />);
    expect(screen.getByRole('group', { name: 'Reps' })).toBeTruthy();
    expect(spin().getAttribute('aria-valuenow')).toBe('6');
    expect(spin().getAttribute('aria-valuemin')).toBe('0');
    expect(spin().getAttribute('aria-valuemax')).toBe('50');
    expect(spin().className).toContain('metric');
    for (const name of ['Decrease Reps', 'Increase Reps']) {
      const button = screen.getByRole('button', { name });
      expect(button.className).toContain('min-h-12');
      expect(button.className).toContain('min-w-12');
    }
    expect(screen.getByText('reps')).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('steps with the buttons and stops at the bounds', async () => {
    renderWithIntl(<Harness initial={49} />);
    const increase = screen.getByRole('button', { name: 'Increase Reps' });
    await userEvent.click(increase);
    expect(spin().getAttribute('aria-valuenow')).toBe('50');
    expect((increase as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(screen.getByRole('button', { name: 'Decrease Reps' }));
    expect(spin().getAttribute('aria-valuenow')).toBe('49');
  });

  it('disables decrease at the minimum', () => {
    renderWithIntl(<Harness initial={0} />);
    expect(
      (screen.getByRole('button', { name: 'Decrease Reps' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('supports arrow, page, Home and End keys, clamped to the bounds', async () => {
    renderWithIntl(<Harness />);
    spin().focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(spin().getAttribute('aria-valuenow')).toBe('7');
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(spin().getAttribute('aria-valuenow')).toBe('5');
    await userEvent.keyboard('{PageUp}');
    expect(spin().getAttribute('aria-valuenow')).toBe('15');
    await userEvent.keyboard('{PageDown}{PageDown}');
    expect(spin().getAttribute('aria-valuenow')).toBe('0');
    await userEvent.keyboard('{End}');
    expect(spin().getAttribute('aria-valuenow')).toBe('50');
    await userEvent.keyboard('{Home}');
    expect(spin().getAttribute('aria-valuenow')).toBe('0');
    await userEvent.keyboard('{Tab}');
  });

  it('accepts typed digits, clamps on blur or Enter, and ignores other keys', async () => {
    const onChange = vi.fn();
    renderWithIntl(<Harness onChange={onChange} />);
    await userEvent.clear(spin());
    await userEvent.type(spin(), '1a2');
    expect((spin() as HTMLInputElement).value).toBe('12');
    await userEvent.keyboard('{Enter}');
    expect(spin().getAttribute('aria-valuenow')).toBe('12');
    await userEvent.clear(spin());
    await userEvent.type(spin(), '99');
    await userEvent.tab();
    expect(spin().getAttribute('aria-valuenow')).toBe('50');
    onChange.mockClear();
    await userEvent.clear(spin());
    await userEvent.tab();
    expect(spin().getAttribute('aria-valuenow')).toBe('50');
    expect(onChange).not.toHaveBeenCalled();
    spin().focus();
    await userEvent.keyboard('x');
    await userEvent.tab();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('D15: labels its buttons in French and accepts a custom id and step', () => {
    renderWithIntl(
      <NumberStepper
        id="hold"
        label="Durée"
        value={30}
        onChange={() => {}}
        min={5}
        max={120}
        step={5}
      />,
      'fr',
    );
    expect(screen.getByRole('button', { name: 'Diminuer : Durée' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Augmenter : Durée' })).toBeTruthy();
    expect(screen.getByRole('spinbutton').id).toBe('hold');
  });
});

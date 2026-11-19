// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { Selector } from './selector';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta', description: 'The second one' },
];

describe('Selector', () => {
  it('one choice: radios in a named group, chosen by keyboard', async () => {
    const { container } = renderWithIntl(
      <Selector legend="Pick one" type="radio" name="one" options={OPTIONS} />,
    );
    expect(screen.getByRole('group', { name: 'Pick one' })).toBeTruthy();
    // The name is the label; the description is announced after it.
    const beta = screen.getByRole('radio', { name: 'Beta' });
    expect(document.getElementById(beta.getAttribute('aria-describedby')!)?.textContent).toBe(
      'The second one',
    );
    await userEvent.tab();
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Alpha' }));
    await userEvent.keyboard(' ');
    expect((screen.getByRole('radio', { name: 'Alpha' }) as HTMLInputElement).checked).toBe(true);
    await userEvent.keyboard('{ArrowDown}');
    expect((beta as HTMLInputElement).checked).toBe(true);
    await expectNoAxeViolations(container);
  });

  it('several choices: checkboxes, with a hint and an error announced with the group', async () => {
    const { container } = renderWithIntl(
      <Selector
        legend="Pick any"
        type="checkbox"
        name="many"
        columns={2}
        hint="As many as you like"
        error="Pick at least one"
        options={OPTIONS}
      />,
    );
    const group = screen.getByRole('group', { name: 'Pick any' });
    expect(group.getAttribute('aria-invalid')).toBe('true');
    const described = group.getAttribute('aria-describedby')!.split(' ');
    expect(described.map((id) => document.getElementById(id)?.textContent)).toEqual([
      'As many as you like',
      'Pick at least one',
    ]);
    await userEvent.click(screen.getByText('Alpha'));
    await userEvent.click(screen.getByText('Beta'));
    expect(screen.getAllByRole('checkbox').every((box) => (box as HTMLInputElement).checked)).toBe(
      true,
    );
    await expectNoAxeViolations(container);
  });

  it('has no description or invalid state when none is given', () => {
    renderWithIntl(<Selector legend="Plain" type="radio" name="plain" options={OPTIONS} />);
    const group = screen.getByRole('group', { name: 'Plain' });
    expect(group.getAttribute('aria-describedby')).toBeNull();
    expect(group.getAttribute('aria-invalid')).toBeNull();
  });
});

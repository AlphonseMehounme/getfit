// @vitest-environment jsdom
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { Scale } from './scale';

describe('Scale', () => {
  it('five radios in a labelled group with the ends described, checked by keyboard', async () => {
    const { container } = renderWithIntl(
      <Scale
        legend="Sleep quality"
        hint="1 = very poor · 5 = very good"
        name="sleep"
        defaultValue={2}
      />,
    );
    const group = screen.getByRole('group', { name: 'Sleep quality' });
    expect(group.getAttribute('aria-describedby')).toBe(
      within(group).getByText('1 = very poor · 5 = very good').id,
    );
    const radios = within(group).getAllByRole('radio') as HTMLInputElement[];
    expect(radios.map((r) => r.value)).toEqual(['1', '2', '3', '4', '5']);
    expect(radios[1]!.checked).toBe(true);
    radios[1]!.focus();
    await userEvent.setup().keyboard('{ArrowRight}');
    expect(radios[2]!.checked).toBe(true);
    await expectNoAxeViolations(container);
  });

  it('unanswered by default', () => {
    renderWithIntl(<Scale legend="Fatigue" hint="1 = none · 5 = extreme" name="fatigue" />);
    expect((screen.getAllByRole('radio') as HTMLInputElement[]).some((r) => r.checked)).toBe(false);
  });
});

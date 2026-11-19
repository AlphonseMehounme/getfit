// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { StartNotices } from './start-notices';

describe('StartNotices (PRD §6.2 AC, D36)', () => {
  it('nothing to say: nothing rendered', () => {
    const { container } = renderWithIntl(
      <StartNotices missingEquipment={[]} availabilityMismatches={[]} />,
    );
    expect(container.textContent).toBe('');
  });

  it('PRD §6.2 AC: warns about missing equipment, by name', async () => {
    const { container } = renderWithIntl(
      <StartNotices missingEquipment={['pull_up_bar']} availabilityMismatches={[]} />,
    );
    expect(screen.getByText('Equipment to check')).toBeTruthy();
    expect(screen.getByText(/This programme uses: Pull-up bar\./)).toBeTruthy();
    expect(screen.queryByText(/differ from the programme/)).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('D36: names the days that differ and says the programme keeps its own', () => {
    renderWithIntl(<StartNotices missingEquipment={[]} availabilityMismatches={[2, 6]} />);
    expect(screen.getByText(/Your answers for Tuesday and Saturday differ/)).toBeTruthy();
    expect(screen.queryByText('Equipment to check')).toBeNull();
  });

  it('both, in French', () => {
    renderWithIntl(
      <StartNotices missingEquipment={['pull_up_bar']} availabilityMismatches={[7]} />,
      'fr',
    );
    expect(screen.getByText(/Ce programme utilise : Barre de traction\./)).toBeTruthy();
    expect(screen.getByText(/Tes réponses pour dimanche diffèrent/)).toBeTruthy();
  });
});

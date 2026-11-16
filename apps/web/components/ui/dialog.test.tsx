// @vitest-environment jsdom
import '@/test/dialog-shim';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { Button } from './button';
import { Dialog } from './dialog';
import { Sheet } from './sheet';

function Harness({ variant, onClose = () => {} }: { variant?: 'sheet'; onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const Panel = variant === 'sheet' ? Sheet : Dialog;
  return (
    <>
      <Button onClick={() => setOpen(true)}>Leave workout</Button>
      <Panel
        open={open}
        onClose={() => {
          setOpen(false);
          onClose();
        }}
        title="Save as partial?"
        description="Every set you logged is kept."
        footer={<Button onClick={() => setOpen(false)}>Keep going</Button>}
      >
        <p>3 of 12 sets logged.</p>
      </Panel>
    </>
  );
}

const dialog = () => screen.getByRole('dialog', { hidden: true }) as HTMLDialogElement;

describe('Dialog', () => {
  it('opens as a labelled, described modal', async () => {
    const { container } = renderWithIntl(<Harness />);
    expect(dialog().open).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Leave workout' }));
    expect(dialog().open).toBe(true);
    expect(screen.getByRole('dialog', { name: 'Save as partial?' })).toBeTruthy();
    expect(dialog().getAttribute('aria-describedby')).toBeTruthy();
    expect(screen.getByText('3 of 12 sets logged.')).toBeTruthy();
    await expectNoAxeViolations(container);
  });

  it('WCAG 2.1.2 / 2.4.3: Escape closes it and focus returns to the opener', async () => {
    const onClose = vi.fn();
    renderWithIntl(<Harness onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'Leave workout' });
    await userEvent.click(opener);
    await userEvent.click(screen.getByRole('button', { name: 'Keep going' }));
    await userEvent.click(opener);
    screen.getByRole('button', { name: 'Close' }).focus();
    await userEvent.keyboard('{Escape}');
    expect(dialog().open).toBe(false);
    expect(onClose).toHaveBeenCalled();
    expect(document.activeElement).toBe(opener);
  });

  it('closes from its labelled close button', async () => {
    const onClose = vi.fn();
    renderWithIntl(<Harness onClose={onClose} />);
    await userEvent.click(screen.getByRole('button', { name: 'Leave workout' }));
    await userEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(dialog().open).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the parent sets open to false', async () => {
    renderWithIntl(<Harness />);
    await userEvent.click(screen.getByRole('button', { name: 'Leave workout' }));
    await userEvent.click(screen.getByRole('button', { name: 'Keep going' }));
    expect(dialog().open).toBe(false);
  });

  it('works without a description or footer, in French', async () => {
    renderWithIntl(
      <Dialog open onClose={() => {}} title="Exercices">
        <p>Liste</p>
      </Dialog>,
      'fr',
    );
    expect(dialog().open).toBe(true);
    expect(dialog().hasAttribute('aria-describedby')).toBe(false);
    expect(screen.getByRole('button', { name: 'Fermer' })).toBeTruthy();
  });
});

describe('Sheet', () => {
  it('is a dialog that sits at the bottom on mobile and the side on desktop', async () => {
    const { container } = renderWithIntl(<Harness variant="sheet" />);
    await userEvent.click(screen.getByRole('button', { name: 'Leave workout' }));
    expect(dialog().open).toBe(true);
    expect(dialog().className).toContain('rounded-t-card');
    expect(dialog().className).toContain('md:w-96');
    await expectNoAxeViolations(container);
  });
});

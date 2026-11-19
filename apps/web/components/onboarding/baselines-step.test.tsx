// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { SavedBaselines } from '@/lib/onboarding/baselines-form';
import type { StepActions } from '@/lib/onboarding/use-step-submit';
import { expectNoAxeViolations, renderWithIntl } from '@/test/render';
import { BaselinesStep } from './baselines-step';

const NONE: SavedBaselines = {
  weight: null,
  maxPullUps: null,
  maxPushUps: null,
  maxSquats: null,
  run: null,
};
const UUID = /^[0-9a-f-]{36}$/;

function renderStep(saved = NONE, units: 'metric' | 'imperial' = 'metric') {
  const actions: StepActions = {
    save: vi.fn(async () => undefined),
    finish: vi.fn(async () => undefined),
  };
  const view = renderWithIntl(<BaselinesStep saved={saved} units={units} actions={actions} />);
  return { ...view, actions };
}

const finish = () => userEvent.click(screen.getByRole('button', { name: 'Finish' }));
const type = (label: string, value: string) => userEvent.type(screen.getByLabelText(label), value);

describe('BaselinesStep (PRD §6.2 step 6, BR-26)', () => {
  it('D54: the last step; nothing typed sends nulls, Skip finishes without saving', async () => {
    const { actions, container } = renderStep();
    expect(screen.getByText('Step 6 of 6')).toBeTruthy();
    // BR-24: no pace yet, with the reason.
    expect(screen.getByText('Enter a distance and a time to see your pace.')).toBeTruthy();
    await expectNoAxeViolations(container);
    await userEvent.click(screen.getByRole('button', { name: 'Skip' }));
    await waitFor(() => expect(actions.finish).toHaveBeenCalledOnce());
    expect(actions.save).not.toHaveBeenCalled();
    await finish();
    await waitFor(() =>
      expect(actions.save).toHaveBeenCalledWith('baselines', {
        weight: null,
        maxPullUps: null,
        maxPushUps: null,
        maxSquats: null,
        run: null,
      }),
    );
  });

  it('BR-22 / D2: the reference run shows 7:20 /km and 8.2 km/h as typed, and is saved in seconds', async () => {
    const { actions } = renderStep();
    await type('Weight (kg)', '55');
    await type('Pull-ups', '10');
    await type('Distance (km)', '10.84');
    await type('Hours', '1');
    await type('Minutes', '19');
    await type('Seconds', '30');
    await userEvent.selectOptions(screen.getByLabelText('Effort (1–10)'), '7');
    expect(screen.getByText('7:20 /km')).toBeTruthy();
    expect(screen.getByText('8.2 km/h')).toBeTruthy();
    await finish();
    await waitFor(() => expect(actions.save).toHaveBeenCalledOnce());
    const [, sent] = vi.mocked(actions.save).mock.calls[0]!;
    expect(sent).toMatchObject({
      weight: { value: 55, unit: 'kg', id: expect.stringMatching(UUID) },
      maxPullUps: { value: 10 },
      maxPushUps: null,
      run: { distance: 10.84, distanceUnit: 'km', durationS: 4770, effort: 7 },
    });
  });

  it('a distance without a time, or the reverse, asks for both', async () => {
    const { actions, container } = renderStep();
    await type('Distance (km)', '5');
    await finish();
    expect(
      await screen.findByText('Enter both a distance and a time, or leave both empty.'),
    ).toBeTruthy();
    await expectNoAxeViolations(container);
    await userEvent.clear(screen.getByLabelText('Distance (km)'));
    await type('Minutes', '30');
    await finish();
    await waitFor(() =>
      expect(
        screen.getAllByText('Enter both a distance and a time, or leave both empty.'),
      ).toHaveLength(1),
    );
    expect(actions.save).not.toHaveBeenCalled();
  });

  it('values out of range say so', async () => {
    const { actions } = renderStep();
    await type('Weight (kg)', '0');
    await type('Push-ups', '501');
    await type('Distance (km)', '-1');
    await type('Seconds', '0');
    await finish();
    expect(await screen.findByText('Enter a valid weight.')).toBeTruthy();
    expect(screen.getByText('Enter a whole number between 0 and 500.')).toBeTruthy();
    expect(screen.getByText('Enter a distance greater than 0.')).toBeTruthy();
    expect(screen.getByText('Enter a time greater than 0.')).toBeTruthy();
    expect(actions.save).not.toHaveBeenCalled();
  });

  it('BR-21: an unusual pace asks first, then "Save anyway" saves; changing the run asks again', async () => {
    const { actions, container } = renderStep();
    await type('Distance (km)', '1');
    await type('Minutes', '1');
    await finish();
    expect(await screen.findByText(/A pace of 1:00 \/km is unusually fast/)).toBeTruthy();
    expect(actions.save).not.toHaveBeenCalled();
    await expectNoAxeViolations(container);
    await type('Seconds', '5');
    expect(screen.queryByText(/unusually fast/)).toBeNull();
    expect(screen.getByRole('button', { name: 'Finish' })).toBeTruthy();
    await finish();
    await userEvent.click(await screen.findByRole('button', { name: 'Save anyway' }));
    await waitFor(() =>
      expect(actions.save).toHaveBeenCalledWith(
        'baselines',
        expect.objectContaining({ run: expect.objectContaining({ durationS: 65 }) }),
      ),
    );
  });

  it('D51: saved baselines show again in imperial units, with their IDs kept', async () => {
    const { actions } = renderStep(
      {
        weight: { id: '00000000-0000-4000-8000-000000000002', weightKg: 55 },
        maxPullUps: { id: '00000000-0000-4000-8000-000000000001', value: 10 },
        maxPushUps: null,
        maxSquats: null,
        run: {
          id: '00000000-0000-4000-8000-000000000003',
          distanceM: 16_093,
          durationS: 3600,
          rpe: null,
        },
      },
      'imperial',
    );
    expect((screen.getByLabelText('Weight (lb)') as HTMLInputElement).value).toBe('121.3');
    expect((screen.getByLabelText('Distance (mi)') as HTMLInputElement).value).toBe('10');
    expect((screen.getByLabelText('Hours') as HTMLInputElement).value).toBe('1');
    expect(screen.getByText('6:00 /mi')).toBeTruthy();
    expect(screen.getByText('10 mph')).toBeTruthy();
    await userEvent.clear(screen.getByLabelText('Pull-ups'));
    await type('Pull-ups', '12');
    await finish();
    await waitFor(() =>
      expect(actions.save).toHaveBeenCalledWith(
        'baselines',
        expect.objectContaining({
          maxPullUps: { id: '00000000-0000-4000-8000-000000000001', value: 12 },
        }),
      ),
    );
  });
});

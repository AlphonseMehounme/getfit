import { type DistanceUnit, metresTo, roundTo } from '@getfit/domain';
import { durationOf, type RunParts, splitDuration } from './run-values';

// PRD §6.6 run form: the values as typed, in the user's units, to and from the run service's input. The start is a
// local date and time in the user's zone; the server turns it into an instant (AGENTS §6).

export interface RunFormValues extends RunParts {
  /** YYYY-MM-DD. */
  date: string;
  /** HH:mm. */
  time: string;
  effort: string;
  routeName: string;
  notes: string;
}

/** A saved run, already in local time and storage units, to pre-fill the edit form. */
export interface RunFormSaved {
  date: string;
  time: string;
  distanceM: number;
  durationS: number;
  rpe: number | null;
  routeName: string | null;
  notes: string | null;
}

export function runFormDefaults(
  saved: RunFormSaved | null,
  start: { date: string; time: string },
  unit: DistanceUnit,
): RunFormValues {
  if (!saved) {
    return {
      ...start,
      distance: null,
      hours: null,
      minutes: null,
      seconds: null,
      effort: '',
      routeName: '',
      notes: '',
    };
  }
  return {
    date: saved.date,
    time: saved.time,
    distance: roundTo(metresTo(saved.distanceM, unit), 2),
    ...splitDuration(saved.durationS),
    effort: saved.rpe ? String(saved.rpe) : '',
    routeName: saved.routeName ?? '',
    notes: saved.notes ?? '',
  };
}

export type LinkChoice = 'none' | 'link' | 'move_and_link';

/** The run service's input. A half-typed time is sent as it is, so the schema reports what is missing. */
export function runInput(v: RunFormValues, id: string, unit: DistanceUnit, link: LinkChoice) {
  return {
    id,
    startedAt: `${v.date}T${v.time}`,
    distance: v.distance,
    distanceUnit: unit,
    durationS: durationOf(v),
    effort: v.effort ? Number(v.effort) : null,
    routeName: v.routeName,
    notes: v.notes,
    link,
  };
}

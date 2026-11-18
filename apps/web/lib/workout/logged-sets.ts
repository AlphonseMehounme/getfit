import {
  exerciseSlots,
  type LoggedMeasure,
  type LoggedSet,
  type Prescription,
  slotKey,
} from '@getfit/domain';
import { setMeasure } from '@/lib/format/target';

// The workout screen's logged values as the domain's logged sets, so progress, totals and what can be saved come
// from the same functions the server uses (AGENTS §5.3, D31).

export function toLoggedSets(
  exercises: readonly { prescription: Prescription }[],
  sets: Readonly<Record<string, { value: number }>>,
): (LoggedSet & LoggedMeasure)[] {
  return exercises.flatMap(({ prescription }) => {
    const measure = setMeasure(prescription.target).kind;
    return exerciseSlots(prescription).flatMap((slot) => {
      const logged = sets[slotKey(slot)];
      if (!logged) return [];
      return [
        {
          ...slot,
          completed: true,
          actualReps: measure === 'reps' ? logged.value : null,
          actualDurationS: measure === 'seconds' ? logged.value : null,
        },
      ];
    });
  });
}

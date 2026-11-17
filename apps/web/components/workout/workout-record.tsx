import { exerciseSlots, formatDuration, type LocalDate, slotKey } from '@getfit/domain';
import Link from 'next/link';
import { useFormatter, useTranslations } from 'next-intl';
import { setMeasure } from '@/lib/format/target';
import type { WorkoutView } from '@/server/services/workout';

// PRD §6.5 / BR-25: a saved workout, read only, against the prescription it was logged with. Sets that were not
// logged say so; nothing is shown as 0 (BR-24).

/** Noon UTC, formatted in UTC, so the calendar date never shifts with the viewer's time zone. */
const toDate = (date: LocalDate) => new Date(`${date}T12:00:00Z`);

export function WorkoutRecord({
  workout,
  backHref,
}: {
  workout: WorkoutView & { status: 'completed' | 'partial' };
  backHref: string;
}) {
  const t = useTranslations('Workout');
  const tRecord = useTranslations('Workout.record');
  const format = useFormatter();
  const logged = new Map(workout.sets.filter((s) => s.completed).map((s) => [slotKey(s), s]));

  const date = workout.scheduledDate
    ? format.dateTime(toDate(workout.scheduledDate), {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        timeZone: 'UTC',
      })
    : null;

  return (
    <article className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{workout.title}</h1>
        <p className="text-muted">
          {date
            ? tRecord('statusLine', { date, status: tRecord(`status.${workout.status}`) })
            : tRecord(`status.${workout.status}`)}
        </p>
      </header>
      <ul className="grid grid-cols-2 gap-3">
        <li className="bg-surface rounded-control col-span-2 p-4 text-xl font-semibold tabular-nums">
          {t('summary.setsLogged', {
            logged: workout.progress.logged,
            total: workout.progress.prescribed,
          })}
        </li>
        <li className="bg-surface rounded-control p-4 font-semibold tabular-nums">
          {t('summary.reps', { reps: workout.totals.reps })}
        </li>
        <li className="bg-surface rounded-control p-4 font-semibold tabular-nums">
          {workout.durationS === null
            ? tRecord('durationNone')
            : tRecord('duration', { duration: formatDuration(workout.durationS) })}
        </li>
        <li className="bg-surface rounded-control col-span-2 p-4 font-semibold tabular-nums">
          {workout.rpe === null ? (
            <>
              {tRecord('rpeNone')}
              <span className="text-muted block text-sm font-normal">{tRecord('rpeNoneHint')}</span>
            </>
          ) : (
            tRecord('rpe', { value: workout.rpe })
          )}
        </li>
      </ul>
      {workout.notes ? (
        <section aria-labelledby="record-notes" className="flex flex-col gap-1">
          <h2 id="record-notes" className="font-semibold">
            {tRecord('notes')}
          </h2>
          <p className="whitespace-pre-line">{workout.notes}</p>
        </section>
      ) : null}
      {workout.exercises.map((exercise) => {
        const kind = setMeasure(exercise.prescription.target).kind;
        const headingId = `record-${exercise.prescription.exerciseId}`;
        return (
          <section key={exercise.prescription.exerciseId} aria-labelledby={headingId}>
            <h2 id={headingId} className="mb-2 text-lg font-semibold">
              {exercise.name}
            </h2>
            <ul className="divide-border border-border rounded-control divide-y border">
              {exerciseSlots(exercise.prescription).map((slot) => {
                const set = logged.get(slotKey(slot));
                const value = set ? (set.actualReps ?? set.actualDurationS) : null;
                return (
                  <li key={slotKey(slot)} className="flex justify-between gap-3 px-4 py-3">
                    <span>
                      {t(
                        slot.side === 'left'
                          ? 'setLeft'
                          : slot.side === 'right'
                            ? 'setRight'
                            : 'set',
                        {
                          number: slot.setNumber,
                        },
                      )}
                    </span>
                    <span className="font-semibold tabular-nums">
                      {value === null
                        ? tRecord('notLogged')
                        : t(kind === 'reps' ? 'loggedReps' : 'loggedSeconds', { value })}
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <Link
        href={backHref}
        className="border-control hover:bg-surface focus-visible:outline-focus rounded-control inline-flex min-h-12 items-center justify-center border px-5 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        {tRecord('back')}
      </Link>
    </article>
  );
}

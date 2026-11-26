'use client';

import { firstOpenSlot } from '@getfit/domain';
import { useEffect, useMemo, useState } from 'react';
import { type LocalWorkout, mergeSets, readLocalWorkout } from '@/lib/offline/local-workout';
import { useOfflineSync } from '@/lib/offline/sync-provider';
import { outboxWorkoutActions } from '@/lib/offline/workout-actions';
import { toLoggedSets } from '@/lib/workout/logged-sets';
import { WorkoutScreen, type WorkoutScreenProps } from './workout-screen';

// P4-05 · BR-6 / D89: the workout screen with its writes through the outbox. The page brings the server's workout;
// once the device's store is open, what this device logged and hasn't synced yet goes on top, and the screen reopens
// at the first set still open (the domain's `firstOpenSlot`, as the page). Without a store (outside the provider, or
// IndexedDB unavailable) it is the online screen, unchanged.

/** The page's props with the device's copy on top. */
function withDeviceCopy(props: WorkoutScreenProps, copy: LocalWorkout): WorkoutScreenProps {
  const initialSets = mergeSets(props.initialSets, copy.sets);
  const prescribed = { exercises: props.exercises.map((e) => e.prescription) };
  const open = firstOpenSlot(prescribed, toLoggedSets(props.exercises, initialSets));
  return {
    ...props,
    initialSets,
    initialIndex: open
      ? props.exercises.findIndex((e) => e.prescription.exerciseId === open.exerciseId)
      : props.exercises.length - 1,
    pausedAtLoad: copy.pause ? copy.pause.paused : props.pausedAtLoad,
    savedOnDevice: copy.finish !== null,
  };
}

export function DeviceWorkoutScreen(props: WorkoutScreenProps) {
  const sync = useOfflineSync();
  const [copy, setCopy] = useState<LocalWorkout | null>(null);
  const { sessionId, logSet, pause, resume, finish } = props;
  const db = sync?.db;
  const push = sync?.push;
  const answer = sync?.answer;

  useEffect(() => {
    if (!db) return;
    let current = true;
    void readLocalWorkout(db, sessionId).then((found) => current && setCopy(found));
    return () => {
      current = false;
    };
  }, [db, sessionId]);

  const actions = useMemo(
    () =>
      db && push && answer
        ? outboxWorkoutActions({ db, push, answer }, { logSet, pause, resume, finish })
        : null,
    [db, push, answer, logSet, pause, resume, finish],
  );

  const screenProps = copy ? withDeviceCopy(props, copy) : props;
  return (
    <WorkoutScreen
      // The device's copy arrives after the first render: the screen starts again from it.
      key={copy ? 'device' : 'server'}
      {...screenProps}
      {...actions}
      sync={sync ? { status: sync.status, notice: sync.notice, onRetry: sync.retry } : undefined}
    />
  );
}

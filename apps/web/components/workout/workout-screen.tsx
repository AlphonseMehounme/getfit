'use client';

import {
  exerciseSlots,
  finishOptions,
  type MassUnit,
  type Prescription,
  restAfter,
  type SetSlot,
  slotKey,
  workoutProgress,
  workoutTotals,
} from '@getfit/domain';
import { List, LogOut, Pause } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { Notice } from '@/components/ui/notice';
import { SyncStatus } from '@/components/ui/sync-status';
import { setMeasure, targetMessage } from '@/lib/format/target';
import { useHydrated } from '@/lib/hooks/use-hydrated';
import { useRestTimer } from '@/lib/hooks/use-rest-timer';
import { type LoggedSetValue, type LogSetAction, useSetLogging } from '@/lib/hooks/use-set-logging';
import { useSkippedExercises } from '@/lib/hooks/use-skipped-exercises';
import { useWakeLock } from '@/lib/hooks/use-wake-lock';
import { type PauseAction, useWorkoutPause } from '@/lib/hooks/use-workout-pause';
import type { ExerciseMedia } from '@/lib/media/resolve';
import type { OutboxStatus } from '@/lib/offline/outbox';
import type { SyncResult } from '@/lib/offline/protocol';
import { toLoggedSets } from '@/lib/workout/logged-sets';
import { ExerciseListSheet } from './exercise-list-sheet';
import { ExerciseStep } from './exercise-step';
import { type FinishAction, type FinishResult, FinishSummary } from './finish-summary';
import { LeaveDialog } from './leave-dialog';
import { PauseOverlay } from './pause-overlay';
import { RestTimer } from './rest-timer';
import { SubstituteSheet } from './substitute-sheet';
import { SetRow } from './set-row';
import { WorkoutNav } from './workout-nav';
import { noticeKey, WorkoutSaved } from './workout-saved';

// PRD §6.5 workout execution: one exercise per screen, every set saved as it is logged (BR-6, D21; see
// useSetLogging). A rest starts on a set's first log (D39, D43, D47), and the screen stays awake while the workout
// is open and not paused (PRD §9). Pause is persisted (D34) and ends a running rest (D50); skipped exercises are
// kept on this device (D49). Through the outbox (P4-05, D89), writes are kept on the device first: the indicator says
// where they are, and a finish still waiting on the device, or kept apart by the server (D90, D104), is said so.

export interface WorkoutScreenExercise {
  name: string;
  media: ExerciseMedia;
  cues: string[];
  prescription: Prescription;
  /** D40: what this exercise can be replaced with, and the one in use (D44). */
  substitutes?: readonly { id: string; name: string; media: ExerciseMedia; cues: string[] }[];
  activeSubstituteId?: string | null;
}

export type { LoggedSetValue, LogSetAction };

export interface WorkoutScreenProps {
  sessionId: string;
  title: string;
  exercises: readonly WorkoutScreenExercise[];
  /** Logged sets by slot key (domain `slotKey`). */
  initialSets: Readonly<Record<string, LoggedSetValue>>;
  /** BR-6: the exercise of the first open set. */
  initialIndex: number;
  logSet: LogSetAction;
  finish: FinishAction;
  /** D34: pause and resume, persisted on the server. */
  pause: PauseAction;
  resume: PauseAction;
  /** D34: the workout was paused when the page was rendered. */
  pausedAtLoad?: boolean;
  /** D41: the unit loads are shown and typed in. */
  loadUnit?: MassUnit;
  /** Active seconds at the request clock when the page was rendered (domain `activeSeconds`). */
  activeSecondsAtLoad: number;
  /** D32: the effort and notes a reopened partial workout was saved with. */
  savedRpe?: number | null;
  savedNotes?: string | null;
  /** Where leaving and saving go: Today. */
  exitHref: string;
  /** D89: the outbox's state, when the writes go through it. */
  sync?: { status: OutboxStatus; notice: SyncResult | null; onRetry: () => void };
  /** A finish chosen on this device still waits to be sent. */
  savedOnDevice?: boolean;
}

export function WorkoutScreen({
  sessionId,
  title,
  exercises,
  initialSets,
  initialIndex,
  logSet,
  finish,
  pause,
  resume,
  pausedAtLoad = false,
  loadUnit = 'kg',
  activeSecondsAtLoad,
  savedRpe = null,
  savedNotes = null,
  exitHref,
  sync,
  savedOnDevice = false,
}: WorkoutScreenProps) {
  const t = useTranslations('Workout');
  const tTarget = useTranslations('Today.target');
  const router = useRouter();
  const [index, setIndex] = useState(initialIndex);
  const {
    sets,
    pending,
    failed,
    log: saveSet,
  } = useSetLogging(sessionId, initialSets, logSet, loadUnit);
  // D40 / D44: the substitute in use for each prescribed exercise, from the last set logged with it.
  const [substitutes, setSubstitutes] = useState<Record<string, string | null>>(() =>
    Object.fromEntries(
      exercises.map((e) => [e.prescription.exerciseId, e.activeSubstituteId ?? null]),
    ),
  );
  const [substituteOpen, setSubstituteOpen] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  /** Seconds spent when the summary opened; null while logging. */
  const [summaryDuration, setSummaryDuration] = useState<number | null>(null);
  /** Saved, but waiting on this device or kept apart by the server; null while the workout is open. */
  const [saved, setSaved] = useState<FinishResult | null>(
    savedOnDevice ? { ok: true, synced: false } : null,
  );
  const onSaved = (result: FinishResult) => {
    if (result.synced === false || result.notice) setSaved(result);
    else router.push(exitHref);
  };
  const hydrated = useHydrated();
  const restTimer = useRestTimer(sessionId);
  const [announcement, setAnnouncement] = useState('');
  const pauseState = useWorkoutPause({
    sessionId,
    pausedAtLoad,
    activeSecondsAtLoad,
    pause,
    resume,
  });
  const [frozenS, setFrozenS] = useState(activeSecondsAtLoad);
  const { skipped, skip, undo } = useSkippedExercises(sessionId);
  useWakeLock(!pauseState.paused);
  const startPause = () => {
    setFrozenS(pauseState.activeSeconds());
    // D50: pausing ends a running rest, with no alert.
    restTimer.clear();
    void pauseState.pause();
  };
  const endRest = () => {
    restTimer.clear();
    setAnnouncement(t('rest.over'));
  };

  const exercise = exercises[index]!;
  const { prescription } = exercise;
  const substituteId = substitutes[prescription.exerciseId] ?? null;
  const active = exercise.substitutes?.find((s) => s.id === substituteId);
  const { kind, value: targetValue } = setMeasure(prescription.target);
  // Strength workouts have no distance targets, so the unit system never matters here.
  const target = targetMessage(prescription, 'metric');
  const loggedCount = (p: Prescription) => exerciseSlots(p).filter((s) => sets[slotKey(s)]).length;
  // AGENTS §5.3: the same domain functions the server uses decide progress, totals and what can be saved (D31).
  const loggedSets = toLoggedSets(exercises, sets);
  const prescribed = { exercises: exercises.map((e) => e.prescription) };
  const progress = workoutProgress(prescribed, loggedSets);
  const openSummary = () => {
    setListOpen(false);
    setSummaryDuration(pauseState.activeSeconds());
  };
  const hasOpenSets = (p: Prescription) => loggedCount(p) < exerciseSlots(p).length;
  // D49: the summary lists the skipped exercises that still have sets to log, in programme order.
  const skippedNames = exercises
    .filter((e) => skipped.has(e.prescription.exerciseId) && hasOpenSets(e.prescription))
    .map((e) => e.name);
  const savePartialAndLeave = async () => {
    const result = await finish({
      sessionId,
      save: 'partial',
      confirm: true,
      rpe: null,
      notes: null,
    });
    if (result.ok) {
      setLeaveOpen(false);
      onSaved(result);
    }
    return result.ok;
  };

  const log = (
    slot: SetSlot,
    value: number,
    details: { load: number | null; rir: number | null },
  ) => {
    // D47: only a set's first log starts a rest; D43 / D39: none after a left side or the last set.
    const restS = sets[slotKey(slot)] ? null : restAfter(prescribed, slot);
    if (restS !== null) {
      setAnnouncement('');
      restTimer.start(restS, new Date());
    }
    void saveSet(slot, { kind, value, ...details, substituteId });
  };

  const setLabel = (slot: SetSlot) =>
    t(slot.side === 'left' ? 'setLeft' : slot.side === 'right' ? 'setRight' : 'set', {
      number: slot.setNumber,
    });

  if (saved) return <WorkoutSaved notice={saved.notice} exitHref={exitHref} />;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <Button variant="secondary" disabled={!hydrated} onClick={() => setLeaveOpen(true)}>
          <LogOut aria-hidden="true" className="size-4" />
          {t('leave')}
        </Button>
        {/* PRD §9: icon-only on a 360 px phone so the header never scrolls sideways; the name stays. */}
        <Button
          variant="secondary"
          disabled={!hydrated}
          onClick={startPause}
          className="max-sm:min-w-12 max-sm:px-3"
        >
          <Pause aria-hidden="true" className="size-4" />
          <span className="max-sm:sr-only">{t('pause.pause')}</span>
        </Button>
        <Button variant="secondary" disabled={!hydrated} onClick={() => setListOpen(true)}>
          <List aria-hidden="true" className="size-4" />
          {t('exercises')}
        </Button>
      </header>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted text-sm">
          {t('progress', { logged: progress.logged, total: progress.prescribed })}
        </p>
        {/* BR-6 / D89: where the logged sets are; without the outbox, when they have all reached the server. */}
        {sync ? (
          <SyncStatus status={sync.status} onRetry={sync.onRetry} />
        ) : (
          <p role="status" className="text-muted text-sm">
            {pending > 0 ? t('saving') : progress.logged > 0 ? t('saved') : null}
          </p>
        )}
      </div>
      {failed ? <FormAlert>{t('saveError')}</FormAlert> : null}
      {/* D90 / D91: amber, not red: nothing is lost, the server kept it (D103). */}
      {sync?.notice ? (
        <Notice tone="warning" title={t('sync.noticeTitle')} live>
          {t(`sync.${noticeKey(sync.notice)}`)}
        </Notice>
      ) : null}
      {pauseState.failed === 'pause' ? <FormAlert>{t('pause.error')}</FormAlert> : null}
      {summaryDuration !== null ? (
        <FinishSummary
          sessionId={sessionId}
          progress={progress}
          options={finishOptions(progress)}
          totals={workoutTotals(loggedSets)}
          skipped={skippedNames}
          durationS={summaryDuration}
          initialRpe={savedRpe}
          initialNotes={savedNotes}
          finish={finish}
          onBack={() => setSummaryDuration(null)}
          onSaved={onSaved}
        />
      ) : (
        <ExerciseStep
          key={prescription.exerciseId}
          name={active?.name ?? exercise.name}
          media={active?.media ?? exercise.media}
          target={tTarget(target.key, target.values)}
          progressed={prescription.overridden}
          cues={active?.cues ?? exercise.cues}
          replaces={active ? exercise.name : undefined}
          onSubstitute={
            hydrated && exercise.substitutes?.length && hasOpenSets(prescription)
              ? () => setSubstituteOpen(true)
              : undefined
          }
          index={index}
          total={exercises.length}
          skip={{
            skipped: skipped.has(prescription.exerciseId) && hasOpenSets(prescription),
            canSkip: hydrated && hasOpenSets(prescription),
            onSkip: () => skip(prescription.exerciseId),
            onUndo: () => undo(prescription.exerciseId),
          }}
        >
          {exerciseSlots(prescription).map((slot) => (
            <SetRow
              key={slotKey(slot)}
              label={setLabel(slot)}
              kind={kind}
              target={targetValue}
              logged={sets[slotKey(slot)]?.value ?? null}
              loggedDetails={{
                load: sets[slotKey(slot)]?.load ?? null,
                rir: sets[slotKey(slot)]?.rir ?? null,
              }}
              unit={loadUnit}
              onLog={(value, details) => log(slot, value, details)}
              onHoldEnd={(seconds) => setAnnouncement(t('hold.ended', { seconds }))}
              disabled={!hydrated}
            />
          ))}
        </ExerciseStep>
      )}
      {/* D39: announces the end of a rest or a hold; it stays mounted so the message is never lost. */}
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {restTimer.rest && summaryDuration === null ? (
        <>
          {/* Room to scroll the set rows above the rest panel. */}
          <div aria-hidden="true" className="h-48" />
          <RestTimer
            endsAt={restTimer.rest.endsAt}
            totalS={restTimer.rest.totalS}
            onExtend={restTimer.extend}
            onSkip={restTimer.clear}
            onDone={endRest}
          />
        </>
      ) : null}
      {summaryDuration === null ? (
        <WorkoutNav
          index={index}
          total={exercises.length}
          disabled={!hydrated}
          onMove={setIndex}
          onFinish={openSummary}
        />
      ) : null}
      <ExerciseListSheet
        open={listOpen}
        onClose={() => setListOpen(false)}
        current={index}
        items={exercises.map((e) => ({
          name: e.name,
          logged: loggedCount(e.prescription),
          total: exerciseSlots(e.prescription).length,
        }))}
        onSelect={(next) => {
          setIndex(next);
          setSummaryDuration(null);
          setListOpen(false);
        }}
        onFinish={openSummary}
      />
      <SubstituteSheet
        open={substituteOpen}
        onClose={() => setSubstituteOpen(false)}
        original={exercise.name}
        options={exercise.substitutes ?? []}
        activeId={substituteId}
        onChoose={(id) => {
          setSubstitutes((current) => ({ ...current, [prescription.exerciseId]: id }));
          setSubstituteOpen(false);
        }}
      />
      <PauseOverlay
        open={pauseState.paused}
        elapsedS={frozenS}
        resumeFailed={pauseState.failed === 'resume'}
        onResume={() => void pauseState.resume()}
      />
      <LeaveDialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        onLeave={() => router.push(exitHref)}
        onSavePartial={savePartialAndLeave}
      />
    </div>
  );
}

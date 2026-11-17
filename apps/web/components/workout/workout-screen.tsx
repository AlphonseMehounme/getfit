'use client';

import {
  exerciseSlots,
  finishOptions,
  type LoggedMeasure,
  type LoggedSet,
  type Prescription,
  type SetSlot,
  slotKey,
  workoutProgress,
  workoutTotals,
} from '@getfit/domain';
import { Check, ChevronLeft, ChevronRight, List, LogOut } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormAlert } from '@/components/ui/form-alert';
import { setMeasure, targetMessage } from '@/lib/format/target';
import { useHydrated } from '@/lib/hooks/use-hydrated';
import type { ExerciseMedia } from '@/lib/media/resolve';
import { ExerciseListSheet } from './exercise-list-sheet';
import { ExerciseStep } from './exercise-step';
import { type FinishAction, FinishSummary } from './finish-summary';
import { LeaveDialog } from './leave-dialog';
import { SetRow } from './set-row';

// PRD §6.5 workout execution (Phase 1 subset): one exercise per screen, every set saved as it is logged (BR-6,
// D21). Writes are optimistic: a failed save rolls the row back and says so, so nothing shows as saved that
// isn't. Each slot keeps one client ID, so a retried save is an idempotent upsert.

export interface WorkoutScreenExercise {
  name: string;
  media: ExerciseMedia;
  cues: string[];
  prescription: Prescription;
}

export interface LoggedSetValue {
  id: string;
  value: number;
}

export type LogSetAction = (input: {
  id: string;
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  side: SetSlot['side'];
  actualReps: number | null;
  actualDurationS: number | null;
  completed: true;
}) => Promise<{ ok: boolean }>;

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
  /** Active seconds at the request clock when the page was rendered (domain `activeSeconds`). */
  activeSecondsAtLoad: number;
  /** D32: the effort and notes a reopened partial workout was saved with. */
  savedRpe?: number | null;
  savedNotes?: string | null;
  /** Where leaving and saving go: Today. */
  exitHref: string;
}

export function WorkoutScreen({
  sessionId,
  title,
  exercises,
  initialSets,
  initialIndex,
  logSet,
  finish,
  activeSecondsAtLoad,
  savedRpe = null,
  savedNotes = null,
  exitHref,
}: WorkoutScreenProps) {
  const t = useTranslations('Workout');
  const tTarget = useTranslations('Today.target');
  const router = useRouter();
  const [index, setIndex] = useState(initialIndex);
  const [sets, setSets] = useState<Record<string, LoggedSetValue>>(initialSets);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(false);
  const [listOpen, setListOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  /** Seconds spent when the summary opened; null while logging. */
  const [summaryDuration, setSummaryDuration] = useState<number | null>(null);
  // When the page became interactive, to add the time spent here to the server's figure.
  const loadedAt = useRef(0);
  useEffect(() => {
    loadedAt.current = performance.now();
  }, []);
  const ids = useRef(new Map<string, string>());
  const hydrated = useHydrated();

  // The browser's "leave page?" prompt only while a set is still being saved (AL, P1-17b).
  useEffect(() => {
    if (pending === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pending]);

  const exercise = exercises[index]!;
  const { prescription } = exercise;
  const { kind, value: targetValue } = setMeasure(prescription.target);
  // Strength workouts have no distance targets, so the unit system never matters here.
  const target = targetMessage(prescription, 'metric');
  const loggedCount = (p: Prescription) => exerciseSlots(p).filter((s) => sets[slotKey(s)]).length;
  // AGENTS §5.3: the same domain functions the server uses decide progress, totals and what can be saved (D31).
  const loggedSets: (LoggedSet & LoggedMeasure)[] = exercises.flatMap(({ prescription: p }) => {
    const measure = setMeasure(p.target).kind;
    return exerciseSlots(p).flatMap((slot) => {
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
  const progress = workoutProgress({ exercises: exercises.map((e) => e.prescription) }, loggedSets);
  const isLast = index === exercises.length - 1;
  const openSummary = () => {
    setListOpen(false);
    setSummaryDuration(
      activeSecondsAtLoad + Math.floor((performance.now() - loadedAt.current) / 1000),
    );
  };
  const savePartialAndLeave = async () => {
    const result = await finish({
      sessionId,
      save: 'partial',
      confirm: true,
      rpe: null,
      notes: null,
    });
    if (result.ok) router.push(exitHref);
    return result.ok;
  };

  const log = async (slot: SetSlot, value: number) => {
    const key = slotKey(slot);
    const previous = sets[key];
    const id = previous?.id ?? ids.current.get(key) ?? crypto.randomUUID();
    ids.current.set(key, id);
    setFailed(false);
    setSets((current) => ({ ...current, [key]: { id, value } }));
    setPending((n) => n + 1);
    try {
      const result = await logSet({
        id,
        sessionId,
        exerciseId: slot.exerciseId,
        setNumber: slot.setNumber,
        side: slot.side,
        actualReps: kind === 'reps' ? value : null,
        actualDurationS: kind === 'seconds' ? value : null,
        completed: true,
      });
      if (!result.ok) throw new Error('log set refused');
    } catch {
      setFailed(true);
      setSets((current) => {
        const next = { ...current };
        if (previous) next[key] = previous;
        else delete next[key];
        return next;
      });
    } finally {
      setPending((n) => n - 1);
    }
  };

  const setLabel = (slot: SetSlot) =>
    t(slot.side === 'left' ? 'setLeft' : slot.side === 'right' ? 'setRight' : 'set', {
      number: slot.setNumber,
    });

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-center justify-between gap-3">
        <Button variant="secondary" disabled={!hydrated} onClick={() => setLeaveOpen(true)}>
          <LogOut aria-hidden="true" className="size-4" />
          {t('leave')}
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
        {/* BR-6: says when every logged set has reached the server. */}
        <p role="status" className="text-muted text-sm">
          {pending > 0 ? t('saving') : progress.logged > 0 ? t('saved') : null}
        </p>
      </div>
      {failed ? <FormAlert>{t('saveError')}</FormAlert> : null}
      {summaryDuration !== null ? (
        <FinishSummary
          sessionId={sessionId}
          progress={progress}
          options={finishOptions(progress)}
          totals={workoutTotals(loggedSets)}
          durationS={summaryDuration}
          initialRpe={savedRpe}
          initialNotes={savedNotes}
          finish={finish}
          onBack={() => setSummaryDuration(null)}
          onSaved={() => router.push(exitHref)}
        />
      ) : (
        <ExerciseStep
          key={prescription.exerciseId}
          name={exercise.name}
          media={exercise.media}
          target={tTarget(target.key, target.values)}
          cues={exercise.cues}
          index={index}
          total={exercises.length}
        >
          {exerciseSlots(prescription).map((slot) => (
            <SetRow
              key={slotKey(slot)}
              label={setLabel(slot)}
              kind={kind}
              target={targetValue}
              logged={sets[slotKey(slot)]?.value ?? null}
              onLog={(value) => void log(slot, value)}
              disabled={!hydrated}
            />
          ))}
        </ExerciseStep>
      )}
      {summaryDuration === null ? (
        <nav
          aria-label={t('exercises')}
          className="bg-background border-border fixed inset-x-0 bottom-0 z-30 border-t pb-[env(safe-area-inset-bottom)]"
        >
          <div className="mx-auto flex w-full max-w-2xl gap-3 px-4 py-3">
            <Button
              variant="secondary"
              width="full"
              disabled={!hydrated || index === 0}
              onClick={() => setIndex(index - 1)}
            >
              <ChevronLeft aria-hidden="true" className="size-5" />
              {t('previous')}
            </Button>
            {isLast ? (
              <Button width="full" disabled={!hydrated} onClick={openSummary}>
                <Check aria-hidden="true" className="size-5" />
                {t('finish')}
              </Button>
            ) : (
              <Button width="full" disabled={!hydrated} onClick={() => setIndex(index + 1)}>
                {t('next')}
                <ChevronRight aria-hidden="true" className="size-5" />
              </Button>
            )}
          </div>
        </nav>
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
      <LeaveDialog
        open={leaveOpen}
        onClose={() => setLeaveOpen(false)}
        onLeave={() => router.push(exitHref)}
        onSavePartial={savePartialAndLeave}
      />
    </div>
  );
}

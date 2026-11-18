import { useEffect, useRef, useState } from 'react';

// D34: pause and resume, persisted on the server so a reload comes back paused. Writes are optimistic: a refused
// pause or resume goes back and says so. Active time excludes pauses: it is the server's figure when the page was
// rendered plus the time spent here, without the time spent paused here (measured with the page's monotonic
// clock, so the device's wall clock never matters).

export type PauseAction = (input: { sessionId: string }) => Promise<{ ok: boolean }>;

export interface WorkoutPauseOptions {
  sessionId: string;
  pausedAtLoad: boolean;
  activeSecondsAtLoad: number;
  pause: PauseAction;
  resume: PauseAction;
}

export function useWorkoutPause({
  sessionId,
  pausedAtLoad,
  activeSecondsAtLoad,
  pause,
  resume,
}: WorkoutPauseOptions) {
  const [paused, setPaused] = useState(pausedAtLoad);
  const [failed, setFailed] = useState<'pause' | 'resume' | null>(null);
  const loadedAt = useRef(0);
  const pausedMs = useRef(0);
  const pauseStart = useRef<number | null>(null);
  // Measured once, when the page becomes interactive; a page loaded paused starts its pause then.
  const loadedPaused = useRef(pausedAtLoad);
  useEffect(() => {
    loadedAt.current = performance.now();
    if (loadedPaused.current) pauseStart.current = loadedAt.current;
  }, []);

  const activeSeconds = () => {
    const now = performance.now();
    const open = pauseStart.current === null ? 0 : now - pauseStart.current;
    return (
      activeSecondsAtLoad + Math.floor((now - loadedAt.current - pausedMs.current - open) / 1000)
    );
  };
  // Only called on a real change (see pause/resume below), so a pause is always open when it ends.
  const startPause = () => {
    pauseStart.current = performance.now();
  };
  const endPause = () => {
    pausedMs.current += performance.now() - pauseStart.current!;
    pauseStart.current = null;
  };

  const write = async (next: boolean) => {
    setFailed(null);
    setPaused(next);
    if (next) startPause();
    else endPause();
    const ok = await (next ? pause : resume)({ sessionId }).then(
      (result) => result.ok,
      () => false,
    );
    if (ok) return;
    setPaused(!next);
    if (next) endPause();
    else startPause();
    setFailed(next ? 'pause' : 'resume');
  };

  return {
    paused,
    failed,
    activeSeconds,
    // Pausing a paused workout or resuming a running one changes nothing (a dialog also reports its own close).
    pause: () => (paused ? Promise.resolve() : write(true)),
    resume: () => (paused ? write(false) : Promise.resolve()),
  };
}

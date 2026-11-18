import { readItem, writeItem } from './device-storage';

// D39: at zero the rest timer (and a timed hold) vibrates and plays a short tone. Sound can be muted per device.
// The tone is generated with Web Audio, so there is no audio file to cache. Both are best effort: iOS Safari has
// no vibration, and some browsers block audio until the user has interacted with the page.

const MUTED_KEY = 'getfit.sound.muted';

export const readMuted = (): boolean => readItem(MUTED_KEY) === '1';

export const writeMuted = (muted: boolean): void => writeItem(MUTED_KEY, muted ? '1' : null);

type AudioWindow = Window & { webkitAudioContext?: typeof AudioContext };

function playTone() {
  const Context = window.AudioContext ?? (window as AudioWindow).webkitAudioContext;
  if (!Context) return;
  const context = new Context();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.frequency.value = 880;
  gain.gain.value = 0.2;
  oscillator.connect(gain).connect(context.destination);
  oscillator.onended = () => void context.close();
  oscillator.start();
  oscillator.stop(context.currentTime + 0.4);
}

export function playEndAlert({ muted }: { muted: boolean }): void {
  try {
    navigator.vibrate?.([200, 100, 200]);
    if (!muted) playTone();
  } catch {
    // An alert that can't play never interrupts the workout.
  }
}

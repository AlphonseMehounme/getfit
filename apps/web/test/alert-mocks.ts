import { vi } from 'vitest';

// Test doubles for the end-of-timer alert (D39): navigator.vibrate and a Web Audio context that records tones.

export interface AlertMocks {
  vibrate: ReturnType<typeof vi.fn>;
  tones: { start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }[];
  closed: ReturnType<typeof vi.fn>;
}

export function mockAlerts(): AlertMocks {
  const vibrate = vi.fn(() => true);
  const tones: AlertMocks['tones'] = [];
  const closed = vi.fn(async () => undefined);
  Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });

  class FakeAudioContext {
    currentTime = 0;
    destination = {};
    close = closed;
    createGain() {
      return { gain: { value: 0 }, connect: (target: unknown) => target };
    }
    createOscillator() {
      const tone = {
        start: vi.fn(),
        stop: vi.fn(() => tone.onended?.()),
        frequency: { value: 0 },
        onended: null as null | (() => void),
        connect: (target: unknown) => target,
      };
      tones.push(tone);
      return tone;
    }
  }
  vi.stubGlobal('AudioContext', FakeAudioContext);
  return { vibrate, tones, closed };
}

/** Sets document.visibilityState and fires visibilitychange. */
export function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
}

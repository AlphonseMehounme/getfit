// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { mockAlerts } from '@/test/alert-mocks';
import { playEndAlert, readMuted, writeMuted } from './end-alert';

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe('playEndAlert', () => {
  it('D39: vibrates and plays one short tone, then closes the audio context', () => {
    const { vibrate, tones, closed } = mockAlerts();
    playEndAlert({ muted: false });
    expect(vibrate).toHaveBeenCalledWith([200, 100, 200]);
    expect(tones).toHaveLength(1);
    expect(tones[0]!.start).toHaveBeenCalled();
    expect(tones[0]!.stop).toHaveBeenCalledWith(0.4);
    expect(closed).toHaveBeenCalled();
  });

  it('D39: muted vibrates without a tone', () => {
    const { vibrate, tones } = mockAlerts();
    playEndAlert({ muted: true });
    expect(vibrate).toHaveBeenCalled();
    expect(tones).toHaveLength(0);
  });

  it('uses the prefixed context where it is the only one, and does nothing without audio', () => {
    const { tones } = mockAlerts();
    const Context = window.AudioContext;
    vi.stubGlobal('AudioContext', undefined);
    vi.stubGlobal('webkitAudioContext', Context);
    playEndAlert({ muted: false });
    expect(tones).toHaveLength(1);
    vi.stubGlobal('webkitAudioContext', undefined);
    expect(() => playEndAlert({ muted: false })).not.toThrow();
  });

  it('never throws when the browser refuses (no vibration, audio blocked)', () => {
    Object.defineProperty(navigator, 'vibrate', {
      value: () => {
        throw new Error('blocked');
      },
      configurable: true,
    });
    expect(() => playEndAlert({ muted: false })).not.toThrow();
  });
});

describe('sound setting', () => {
  it('D39: is kept per device', () => {
    expect(readMuted()).toBe(false);
    writeMuted(true);
    expect(readMuted()).toBe(true);
    writeMuted(false);
    expect(readMuted()).toBe(false);
  });
});

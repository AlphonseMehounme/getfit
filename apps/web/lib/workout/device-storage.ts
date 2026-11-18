// D39 / D48: timer state and the sound setting stay on this device. Storage can be missing or throw (private
// windows, blocked site data), so every access is guarded and the screen works without it.

export function readItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** Writes `value`, or removes the key when it is null. Failures are ignored. */
export function writeItem(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the timer simply isn't kept (D48).
  }
}

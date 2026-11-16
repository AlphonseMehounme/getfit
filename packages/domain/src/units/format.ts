// BR-23: locale-neutral formatting tokens. "m:ss" and "h:mm:ss" read the same in French and English;
// numbers with decimals (km, km/h, kg) are formatted by the UI with Intl for the locale ("10,84 km").

const pad2 = (value: number) => String(value).padStart(2, '0');

function wholeSeconds(seconds: number): number {
  if (!(seconds >= 0) || !Number.isFinite(seconds)) {
    throw new RangeError('A duration is a finite number of seconds ≥ 0');
  }
  // Round the total first, so 479.5 s is "8:00", never "7:60".
  return Math.round(seconds);
}

/** BR-23: a pace in seconds per km or mile, as "m:ss" (440 → "7:20"). */
export function formatPace(secondsPerUnit: number): string {
  const total = wholeSeconds(secondsPerUnit);
  return `${Math.floor(total / 60)}:${pad2(total % 60)}`;
}

/** A duration as "h:mm:ss", or "m:ss" under one hour (4,770 → "1:19:30"; 1,800 → "30:00"). */
export function formatDuration(seconds: number): string {
  const total = wholeSeconds(seconds);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  return hours > 0 ? `${hours}:${pad2(minutes)}:${pad2(secs)}` : `${minutes}:${pad2(secs)}`;
}

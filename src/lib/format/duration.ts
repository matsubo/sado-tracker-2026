/**
 * Elapsed-time formatting for the live tracker.
 *
 * Every input is an integer number of milliseconds. The upstream timing system
 * truncates sub-second precision rather than rounding it, so this module does
 * the same: 3_661_999 ms renders as "1:01:01", never "1:01:02".
 */

const DASH = "—";
const MINUS_SIGN = "−";
const SECOND = 1000;
const MINUTE = 60;
const HOUR = 3600;

/** Zero-pads a positive integer to two digits. */
const pad2 = (value: number): string => String(value).padStart(2, "0");

/** Truncates milliseconds to whole seconds, discarding the sub-second part. */
const toWholeSeconds = (ms: number): number => Math.trunc(ms / SECOND);

/** Splits whole seconds into hour, minute and second components. */
const split = (totalSeconds: number): { h: number; m: number; s: number } => ({
  h: Math.floor(totalSeconds / HOUR),
  m: Math.floor((totalSeconds % HOUR) / MINUTE),
  s: totalSeconds % MINUTE,
});

/** True when the value can be rendered as an elapsed duration. */
const isRenderable = (ms: number): boolean => Number.isFinite(ms) && ms >= 0;

/** Formats an elapsed duration as "h:mm:ss" with unpadded hours. */
export function formatDuration(ms: number): string {
  if (!isRenderable(ms)) return DASH;
  const { h, m, s } = split(toWholeSeconds(ms));
  return `${h}:${pad2(m)}:${pad2(s)}`;
}

/** Formats an elapsed duration as "h:mm", or "m:ss" when under one hour. */
export function formatDurationShort(ms: number): string {
  if (!isRenderable(ms)) return DASH;
  const total = toWholeSeconds(ms);
  const { h, m, s } = split(total);
  return total >= HOUR ? `${h}:${pad2(m)}` : `${m}:${pad2(s)}`;
}

/** Formats a signed time difference, e.g. "+3:41", "−0:35" or "+1:02:03". */
export function formatDiff(ms: number): string {
  if (!Number.isFinite(ms) || ms === 0) return DASH;
  const sign = ms > 0 ? "+" : MINUS_SIGN;
  const total = toWholeSeconds(Math.abs(ms));
  const { h, m, s } = split(total);
  const body = total >= HOUR ? `${h}:${pad2(m)}:${pad2(s)}` : `${m}:${pad2(s)}`;
  return `${sign}${body}`;
}

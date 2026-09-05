/**
 * Wall-clock formatting pinned to the race timezone.
 *
 * Every Intl call passes an explicit locale, timeZone and hourCycle so the
 * server render and the client hydration produce byte-identical output
 * regardless of the host timezone or the engine's default hour cycle.
 * Output is assembled from formatToParts rather than the locale's own
 * literals, which vary between ICU versions.
 */

const DASH = "—";
const LOCALE = "ja-JP";
const TIME_ZONE = "Asia/Tokyo";

type Field = "month" | "day" | "hour" | "minute" | "second";

const formatter = new Intl.DateTimeFormat(LOCALE, {
  timeZone: TIME_ZONE,
  hourCycle: "h23",
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Extracts the Tokyo-local calendar and clock fields of an epoch timestamp. */
const partsOf = (epochMs: number): Record<Field, string> => {
  const parts = formatter.formatToParts(new Date(epochMs));
  const read = (field: Field): string => parts.find((part) => part.type === field)?.value ?? "";
  return {
    month: read("month"),
    day: read("day"),
    hour: read("hour").padStart(2, "0"),
    minute: read("minute").padStart(2, "0"),
    second: read("second").padStart(2, "0"),
  };
};

/** Formats an epoch timestamp as "HH:MM:SS" in Asia/Tokyo. */
export function formatClock(epochMs: number): string {
  if (!Number.isFinite(epochMs)) return DASH;
  const { hour, minute, second } = partsOf(epochMs);
  return `${hour}:${minute}:${second}`;
}

/** Formats an epoch timestamp as "HH:MM" in Asia/Tokyo. */
export function formatClockShort(epochMs: number): string {
  if (!Number.isFinite(epochMs)) return DASH;
  const { hour, minute } = partsOf(epochMs);
  return `${hour}:${minute}`;
}

/** Formats an epoch timestamp as "M/D HH:MM" in Asia/Tokyo. */
export function formatDateTime(epochMs: number): string {
  if (!Number.isFinite(epochMs)) return DASH;
  const { month, day, hour, minute } = partsOf(epochMs);
  return `${month}/${day} ${hour}:${minute}`;
}

/**
 * The export prints wall-clock times in Asia/Tokyo with no zone marker, and
 * Japan has no daylight saving, so a fixed +09:00 offset is exact.
 */
const JST_OFFSET_MS = 9 * 60 * 60 * 1000;

const TIMESTAMP = /^(\d{4})\/(\d{1,2})\/(\d{1,2}) (\d{1,2}):(\d{2}):(\d{2})$/;

/** Parse "2026/09/06 07:20:30" plus its separate millisecond column. */
export function parseJstTimestamp(text: string, ms: string): number | null {
  const match = TIMESTAMP.exec(text.trim());
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const base = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
  );
  return base - JST_OFFSET_MS + parseMilliseconds(ms);
}

/** The ms column holds up to three digits, sometimes zero-padded ("038"). */
function parseMilliseconds(ms: string): number {
  const digits = ms.trim();
  if (digits === "") return 0;
  const value = Number.parseInt(digits, 10);
  return Number.isFinite(value) && value >= 0 && value < 1000 ? value : 0;
}

/** Combine a race date and an "HH:MM" wave start into epoch milliseconds. */
export function waveStartToEpoch(raceDate: string, waveStart: string): number {
  const [year, month, day] = raceDate.split("-").map(Number);
  const [hour, minute] = waveStart.split(":").map(Number);
  return (
    Date.UTC(year as number, (month as number) - 1, day as number, hour as number, minute as number) -
    JST_OFFSET_MS
  );
}

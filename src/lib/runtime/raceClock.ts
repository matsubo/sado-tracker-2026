/**
 * The client projects positions between server updates, and that projection
 * must run on the race's clock, not the device's. Two things break otherwise:
 * a viewer whose phone clock is off by minutes sees athletes in the wrong
 * place, and replay mode, where the server's clock is a past race running
 * fast, would project a year of travel in one step.
 *
 * The offset is refreshed from every race-state response.
 */
let offsetMs = 0;

export function setRaceClockOffset(serverNowMs: number): void {
  if (Number.isFinite(serverNowMs)) offsetMs = serverNowMs - Date.now();
}

/** Current time on the race's clock. */
export function raceNow(): number {
  return Date.now() + offsetMs;
}

/** Test helper: forget any offset learned from a response. */
export function resetRaceClock(): void {
  offsetMs = 0;
}

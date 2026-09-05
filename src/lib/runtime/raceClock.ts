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
let known = false;

export function setRaceClockOffset(serverNowMs: number): void {
  if (!Number.isFinite(serverNowMs)) return;
  offsetMs = serverNowMs - Date.now();
  known = true;
}

/**
 * True once a server response has told us what time the race is on. Until
 * then the device clock is not a usable substitute: in replay it is a year
 * out, which would push every athlete to the next timing point.
 */
export function hasRaceClock(): boolean {
  return known;
}

/** Current time on the race's clock, or 0 while it is still unknown. */
export function raceNow(): number {
  return known ? Date.now() + offsetMs : 0;
}

/** Test helper: forget any offset learned from a response. */
export function resetRaceClock(): void {
  offsetMs = 0;
  known = false;
}

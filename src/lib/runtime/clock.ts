export interface Clock {
  now(): number;
  /** True when the clock is replaying a past race rather than tracking now. */
  readonly replay: boolean;
}

export const systemClock: Clock = { now: () => Date.now(), replay: false };

/**
 * A clock that starts at a past moment and runs faster than real time, so a
 * finished race can be replayed to exercise the live paths before race day.
 */
export function replayClock(startIso: string, speed: number, realNow = Date.now()): Clock {
  const virtualStart = Date.parse(startIso);
  if (!Number.isFinite(virtualStart)) {
    throw new Error(`REPLAY_START is not a valid date: ${startIso}`);
  }
  return {
    now: () => virtualStart + (Date.now() - realNow) * speed,
    replay: true,
  };
}

/** Build the clock from the environment: replay when REPLAY_START is set. */
export function clockFromEnv(env: NodeJS.ProcessEnv = process.env): Clock {
  const start = env.REPLAY_START;
  if (!start) return systemClock;
  const speed = Number(env.REPLAY_SPEED ?? "60");
  return replayClock(start, Number.isFinite(speed) && speed > 0 ? speed : 60);
}

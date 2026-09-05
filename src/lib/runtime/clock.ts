export interface Clock {
  now(): number;
  /** True when the clock is replaying a past race rather than tracking now. */
  readonly replay: boolean;
  /** How many race seconds pass per real second. */
  readonly speed: number;
}

export const systemClock: Clock = { now: () => Date.now(), replay: false, speed: 1 };

/** A race day runs from the first wave to the last finisher. */
const DEFAULT_REPLAY_WINDOW_MS = 14 * 60 * 60 * 1000;

export interface ReplayOptions {
  /** Milliseconds of race covered before looping back to the start. */
  readonly windowMs?: number;
  readonly realNow?: number;
}

/**
 * A clock that starts at a past moment and runs faster than real time, so a
 * finished race can be replayed to exercise the live paths before race day.
 *
 * It loops. Without that, a fast replay reaches the last finisher within
 * minutes and then sits on a finished race, so anyone who opens the page
 * afterwards sees a leaderboard that never moves.
 */
export function replayClock(startIso: string, speed: number, options: ReplayOptions = {}): Clock {
  const virtualStart = Date.parse(startIso);
  if (!Number.isFinite(virtualStart)) {
    throw new Error(`REPLAY_START is not a valid date: ${startIso}`);
  }

  const windowMs = options.windowMs ?? DEFAULT_REPLAY_WINDOW_MS;
  const realNow = options.realNow ?? Date.now();

  return {
    now: () => {
      const elapsed = (Date.now() - realNow) * speed;
      return virtualStart + (windowMs > 0 ? elapsed % windowMs : elapsed);
    },
    replay: true,
    speed,
  };
}

/** Build the clock from the environment: replay when REPLAY_START is set. */
export function clockFromEnv(env: NodeJS.ProcessEnv = process.env): Clock {
  const start = env.REPLAY_START;
  if (!start) return systemClock;

  const rawSpeed = Number(env.REPLAY_SPEED ?? "60");
  const speed = Number.isFinite(rawSpeed) && rawSpeed > 0 ? rawSpeed : 60;

  const rawHours = Number(env.REPLAY_HOURS ?? "14");
  const windowMs = (Number.isFinite(rawHours) && rawHours > 0 ? rawHours : 14) * 3_600_000;

  return replayClock(start, speed, { windowMs });
}

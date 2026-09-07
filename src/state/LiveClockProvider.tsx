"use client";

import { createContext, type ReactNode, useContext, useEffect, useState } from "react";
import { raceNow } from "@/lib/runtime/raceClock";
import { RaceContext } from "./RaceProvider";

const TICK_MS = 10_000;

export const LiveClockContext = createContext<number | null>(null);

/**
 * One slow clock on the race's timeline for every component that animates a
 * position, rather than an interval per card. It stays at zero until a server
 * response has established what time the race is on, and callers treat zero
 * as "use the estimate the server sent". The device clock is never a stand-in:
 * in replay it is a year out, and projecting from it pins the whole field to
 * the next timing point.
 */
export function LiveClockProvider({ children }: { readonly children: ReactNode }) {
  const [now, setNow] = useState(0);
  const fetchedAt = useContext(RaceContext)?.fetchedAt ?? null;

  useEffect(() => {
    // A fresh race response resets the offset; read it at once, not next tick.
    setNow(fetchedAt === null ? 0 : raceNow());
    const timer = setInterval(() => setNow(raceNow()), TICK_MS);
    return () => clearInterval(timer);
  }, [fetchedAt]);

  return <LiveClockContext.Provider value={now}>{children}</LiveClockContext.Provider>;
}

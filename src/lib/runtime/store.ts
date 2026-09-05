import type { ComputedSnapshot } from "@/lib/compute/snapshot";

/**
 * The computed snapshot lives in module state. Next runs route handlers in
 * the same process as instrumentation, so a plain module variable is the
 * cheapest correct cache; a restart refills it from the first poll.
 */
let current: ComputedSnapshot | null = null;
const listeners = new Set<(snapshot: ComputedSnapshot) => void>();

export function getSnapshot(): ComputedSnapshot | null {
  return current;
}

export function setSnapshot(snapshot: ComputedSnapshot): void {
  current = snapshot;
  for (const listener of listeners) listener(snapshot);
}

export function onSnapshot(listener: (snapshot: ComputedSnapshot) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Mark the current snapshot as stale after a failed refresh. */
export function markStale(): void {
  if (current) current = { ...current, stale: true };
}

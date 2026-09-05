import type { ComputedSnapshot } from "@/lib/compute/snapshot";

/**
 * The computed snapshot is held on globalThis rather than in a module
 * variable. The instrumentation hook and the route handlers are bundled
 * separately, so a module-level variable would give each its own copy and the
 * routes would never see the poller's work.
 */
const KEY = Symbol.for("sado-tracker.snapshot");

interface Slot {
  snapshot: ComputedSnapshot | null;
  started: boolean;
}

function slot(): Slot {
  const store = globalThis as typeof globalThis & { [KEY]?: Slot };
  if (!store[KEY]) store[KEY] = { snapshot: null, started: false };
  return store[KEY];
}

export function getSnapshot(): ComputedSnapshot | null {
  return slot().snapshot;
}

export function setSnapshot(snapshot: ComputedSnapshot): void {
  slot().snapshot = snapshot;
}

/** Keep the last good snapshot but tell readers it failed to refresh. */
export function markStale(): void {
  const current = slot();
  if (current.snapshot) current.snapshot = { ...current.snapshot, stale: true };
}

/** Guards the pollers so they start exactly once per process. */
export function claimPollerStart(): boolean {
  const current = slot();
  if (current.started) return false;
  current.started = true;
  return true;
}

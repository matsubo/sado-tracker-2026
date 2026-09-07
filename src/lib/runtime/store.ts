import type { ComputedSnapshot } from "@/lib/compute/snapshot";
import type { PollerHandle } from "./types";

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
  /** What a refresh needs, so a route handler can trigger one. */
  handle: PollerHandle | null;
}

function slot(): Slot {
  const store = globalThis as typeof globalThis & { [KEY]?: Slot };
  if (!store[KEY]) store[KEY] = { snapshot: null, started: false, handle: null };
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

/**
 * The poller's runtime, shared the same way as the snapshot: the poller and
 * the route handlers are bundled separately, so a module variable would give
 * each its own copy and a manual refresh would find nothing to run.
 */
export function setPollerHandle(handle: PollerHandle): void {
  slot().handle = handle;
}

export function getPollerHandle(): PollerHandle | null {
  return slot().handle;
}

/** Guards the pollers so they start exactly once per process. */
export function claimPollerStart(): boolean {
  const current = slot();
  if (current.started) return false;
  current.started = true;
  return true;
}

/** Test helper: forget everything, as a fresh process would. */
export function resetStore(): void {
  const current = slot();
  current.snapshot = null;
  current.started = false;
  current.handle = null;
}

import type { BacktestTable } from "@/lib/compute/prediction";
import type { NeighbourModel } from "@/lib/history/model";
import type { NameIndex } from "@/lib/history/nameIndex";
import type { Clock } from "./clock";

/** Everything a refresh needs that is built once at start-up. */
export interface PollerRuntime {
  readonly clock: Clock;
  readonly model: NeighbourModel;
  readonly nameIndex: NameIndex;
  readonly backtest: BacktestTable;
  /** The past races the model and the name index were built from. */
  readonly historyYears: readonly number[];
}

/** What the poller touches outside its own code, so a test can stand it all in. */
export interface PollerDeps {
  readonly env: Partial<NodeJS.ProcessEnv>;
  readonly fetchCsv: (url: string) => Promise<ArrayBuffer>;
  readonly readFile: (path: string) => Buffer;
  readonly exists: (path: string) => boolean;
  readonly writeFile: (path: string, data: Uint8Array) => void;
  /** The real clock, for deciding whether the timing site is worth asking. */
  readonly wallClock: () => number;
}

/** The runtime and the world it was started in, kept so a route can refresh. */
export interface PollerHandle {
  readonly runtime: PollerRuntime;
  readonly deps: PollerDeps;
}

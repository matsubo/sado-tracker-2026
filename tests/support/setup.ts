import { configure } from "@testing-library/dom";
import { vi } from "vitest";

// The whole suite runs in parallel, and a debounce plus a fetch can take
// longer than the default second when every core is busy.
configure({ asyncUtilTimeout: 4_000 });

// The server logger writes JSON lines to stderr. Several suites make it
// warn or fail on purpose, and none of them read what it wrote.
vi.mock("@/lib/runtime/logger", () => ({
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  logOnce: () => {},
}));

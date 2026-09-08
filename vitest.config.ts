import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": resolve(import.meta.dirname, "./src") } },
  test: {
    environment: "node",
    // Some suites replay a whole race against real timing data, and build
    // it once in a hook before their tests run.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/support/setup.ts"],
    coverage: {
      provider: "v8",
      // Everything but the Next.js route and page shells, which only parse a
      // request and hand it to a library function; the end-to-end suite
      // covers those.
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/app/**", "src/instrumentation.ts"],
      reporter: ["text-summary", "lcov"],
      // A ratchet: the numbers the suite reaches today, so a change that
      // drops below them fails CI. Raise them as tests are added.
      thresholds: { statements: 84, branches: 71, functions: 82, lines: 86 },
    },
  },
});

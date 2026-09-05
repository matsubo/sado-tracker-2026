import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": resolve(import.meta.dirname, "./src") } },
  test: {
    environment: "node",
    // Some suites replay a whole race against real timing data.
    testTimeout: 30_000,
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.{ts,tsx}"],
    coverage: { provider: "v8", include: ["src/lib/**", "src/config/**"], reporter: ["text", "lcov"] },
  },
});

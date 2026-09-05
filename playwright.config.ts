import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;

/**
 * End-to-end tests run against a replay of the finished 2025 race, so the
 * live code paths are exercised with real timing data rather than a mock.
 */
export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
  },
  projects: [{ name: "mobile", use: { ...devices["iPhone 14"] } }],
  webServer: {
    command: `bunx next dev -p ${PORT}`,
    url: `http://127.0.0.1:${PORT}/api/race`,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    env: {
      RACE_YEAR: "2025",
      REPLAY_START: "2025-09-07T14:00:00+09:00",
      REPLAY_SPEED: "30",
      DATA_DIR: ".data",
      TZ: "Asia/Tokyo",
    },
  },
});

import { defineConfig, devices } from "@playwright/test";

const localBaseURL = "http://127.0.0.1:3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? localBaseURL;
const useLocalWebServer = baseURL === localBaseURL;

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    timezoneId: "UTC",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: useLocalWebServer
    ? {
        command: "bun run dev -- --port 3000",
        url: localBaseURL,
        timeout: 180_000,
        reuseExistingServer: !process.env.CI,
        env: {
          ...process.env,
          TZ: process.env.TZ ?? "UTC",
        },
      }
    : undefined,
});

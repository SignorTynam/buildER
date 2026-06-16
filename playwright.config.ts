import { defineConfig, devices } from "@playwright/test";

const devServerCommand =
  process.platform === "win32"
    ? "npm.cmd run dev -- --host 127.0.0.1"
    : "npm run dev -- --host 127.0.0.1";

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: devServerCommand,
    url: "http://127.0.0.1:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      VITE_APP_BOOT_DELAY_MS: "1200",
    },
  },
});

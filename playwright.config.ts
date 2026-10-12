import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { defineConfig, devices } from "@playwright/test";
import config from "./src/config";

// macOS 27 blocks Playwright's Firefox from the real Firefox's data folder, so
// it exits with "Could not find profile folder". Each worker process loads
// this config, so each Firefox gets its own fake home. Remove once Playwright
// ships Firefox 158: https://github.com/microsoft/playwright/issues/42768
// ponytail: the homes stay in $TMPDIR, since macOS locks the empty folders
// Firefox creates in them against deletion.
const firefoxHome =
  process.platform === "darwin"
    ? mkdtempSync(path.join(tmpdir(), "playwright-firefox-home-"))
    : undefined;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: process.env["CI"] ? 1 : "50%",
  reporter: "html",
  use: {
    baseURL: config.baseUrl,
    trace: "on-first-retry",
    ...(firefoxHome && {
      launchOptions: {
        env: { ...process.env, CFFIXED_USER_HOME: firefoxHome },
      },
    }),
  },
  projects: [
    {
      name: "main",
      testIgnore: /alerts\.spec/,
      use: { ...devices["Desktop Firefox"] },
    },
    // Run alerts.spec after other tests to avoid race conditions on checks for
    // recent donations.
    {
      name: "alerts",
      testMatch: /alerts\.spec/,
      dependencies: ["main"],
      use: { ...devices["Desktop Firefox"] },
    },
  ],
  webServer: {
    command: "bun run start",
    url: config.baseUrl,
    reuseExistingServer: !process.env["CI"],
    env: {
      ALERTS_PASSWORD: config.alertsPassword,
      ALERTS_USERNAME: config.alertsUsername,
      DISABLE_EMAIL: "true",
      DISABLE_RATE_LIMIT: "true",
      SERVER_HOST: config.serverHost,
      STRIPE_PUBLIC: config.stripePublicKey,
      STRIPE_SECRET: config.stripeSecretKey,
      STRIPE_PORTAL_CONFIG: config.stripePortalConfig,
      GITHUB_CLIENT_ID: config.githubClientId,
      GITHUB_SECRET: config.githubSecret,
      GOOGLE_CLIENT_ID: config.googleClientId,
      GOOGLE_SECRET: config.googleSecret,
      COOKIE_SECRET: config.cookieSecret,
      RESEND_KEY: config.resendKey,
      TOTP_SECRET: config.totpSecret,
      FRONTEND_DSN: config.frontendDSN.toString(),
      BACKEND_DSN: config.backendDSN.toString(),
    },
  },
});

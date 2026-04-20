import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config();

const config = (await import("./src/config")).default;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: config.baseUrl,
    trace: "on-first-retry",
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
    reuseExistingServer: !process.env.CI,
    env: {
      ALERTS_PASSWORD: config.alertsPassword,
      ALERTS_USERNAME: config.alertsUsername,
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

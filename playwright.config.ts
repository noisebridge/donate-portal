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
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
  ],
  webServer: {
    command: "bun run start",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    env: {
      SERVER_HOST: config.serverHost,
      STRIPE_SECRET: config.stripeSecretKey,
      GITHUB_CLIENT_ID: config.githubClientId,
      GITHUB_SECRET: config.githubSecret,
      GOOGLE_CLIENT_ID: config.googleClientId,
      GOOGLE_SECRET: config.googleSecret,
      COOKIE_SECRET: config.cookieSecret,
      RESEND_KEY: config.resendKey,
      TOTP_SECRET: config.totpSecret,
    },
  },
});

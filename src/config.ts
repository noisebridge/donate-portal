import dotenv from "dotenv";

dotenv.config();

function assertEnvVar(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }

  return value;
}

const serverProtocol = process.env.NODE_ENV === "production" ? "https" : "http";
const serverHost = assertEnvVar("SERVER_HOST");

export default {
  disableRateLimit: process.env["DISABLE_RATE_LIMIT"] === "true",
  production: process.env.NODE_ENV === "production",
  gitRepo: process.env["RENDER_GIT_REPO_SLUG"],
  gitCommit: process.env["RENDER_GIT_COMMIT"],
  serverProtocol,
  serverHost,
  serverPort: parseInt(process.env["PORT"] || "3000", 10),
  baseUrl: `${serverProtocol}://${serverHost}`,
  stripePublicKey: assertEnvVar("STRIPE_PUBLIC"),
  stripeSecretKey: assertEnvVar("STRIPE_SECRET"),
  stripePortalConfig: assertEnvVar("STRIPE_PORTAL_CONFIG"),
  stripeWebhookSecret: process.env["STRIPE_WEBHOOK_SECRET"],
  githubClientId: assertEnvVar("GITHUB_CLIENT_ID"),
  githubSecret: assertEnvVar("GITHUB_SECRET"),
  googleClientId: assertEnvVar("GOOGLE_CLIENT_ID"),
  googleSecret: assertEnvVar("GOOGLE_SECRET"),
  cookieSecret: assertEnvVar("COOKIE_SECRET"),
  resendKey: assertEnvVar("RESEND_KEY"),
  emailSender: process.env["EMAIL_SENDER"] || "onboarding@resend.dev",
  totpSecret: assertEnvVar("TOTP_SECRET"),
  alertsUsername: assertEnvVar("ALERTS_USERNAME"),
  alertsPassword: assertEnvVar("ALERTS_PASSWORD"),
  frontendDSN: new URL(assertEnvVar("FRONTEND_DSN")),
  backendDSN: new URL(assertEnvVar("BACKEND_DSN")),
};

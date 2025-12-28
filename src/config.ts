function assertEnvVar(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }

  return value;
}

export default {
  testingBackdoor: process.env["TESTING_BACKDOOR"] === "enabled",
  production: process.env.NODE_ENV === "production",
  gitRepo: process.env["RENDER_GIT_REPO_SLUG"],
  gitCommit: process.env["RENDER_GIT_COMMIT"],
  serverProtocol: process.env.NODE_ENV === "production" ? "https" : "http",
  serverHost: assertEnvVar("SERVER_HOST"),
  serverPort: parseInt(process.env["PORT"] || "3000", 10),
  stripeSecretKey: assertEnvVar("STRIPE_SECRET"),
  stripePortalConfig: assertEnvVar("STRIPE_PORTAL_CONFIG"),
  stripeWebhookSecret: process.env["STRIPE_WEBHOOK_SECRET"],
  githubClientId: assertEnvVar("GITHUB_CLIENT_ID"),
  githubSecret: assertEnvVar("GITHUB_SECRET"),
  googleClientId: assertEnvVar("GOOGLE_CLIENT_ID"),
  googleSecret: assertEnvVar("GOOGLE_SECRET"),
  cookieSecret: assertEnvVar("COOKIE_SECRET"),
  resendKey: assertEnvVar("RESEND_KEY"),
  emailDomain: process.env["EMAIL_DOMAIN"] || "onboarding@resend.dev",
  totpSecret: assertEnvVar("TOTP_SECRET"),
};

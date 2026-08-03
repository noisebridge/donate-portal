import { isIP } from "node:net";
import dotenv from "dotenv";
import logger from "~/lib/logger";

dotenv.config();

function assertEnvVar(key: string) {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }

  return value;
}

function getRateLimitAllowList(): string[] {
  const allowListEnvVar = process.env["RATE_LIMIT_ALLOW_LIST"];
  if (!allowListEnvVar) {
    return [];
  }

  let parsedAllowList: unknown;
  try {
    parsedAllowList = JSON.parse(allowListEnvVar);
  } catch (e) {
    logger.error({ exception: e }, "Failed to parse RATE_LIMIT_ALLOW_LIST");
    return [];
  }
  if (!Array.isArray(parsedAllowList)) {
    logger.error("RATE_LIMIT_ALLOW_LIST is not an array");
    return [];
  }

  for (const elem of parsedAllowList) {
    if (!isIP(elem)) {
      logger.error({ elem }, "RATE_LIMIT_ALLOW_LIST holds a non-IP element");
      return [];
    }
  }

  return parsedAllowList;
}

const serverProtocol =
  process.env["NODE_ENV"] === "production" ? "https" : "http";
const serverHost = assertEnvVar("SERVER_HOST");

export default {
  disableRateLimit: process.env["DISABLE_RATE_LIMIT"] === "true",
  // Comma-separated IPs/CIDRs (or @fastify/proxy-addr names) of the proxies in
  // front of us. Deployments set the exact peer range.
  trustedProxies:
    process.env["TRUSTED_PROXIES"] || "loopback,linklocal,uniquelocal",
  rateLimitAllowList: getRateLimitAllowList(),
  production: process.env["NODE_ENV"] === "production",
  gitRepo: process.env["REPO_SLUG"],
  gitCommit: process.env["GIT_COMMIT"],
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
  noisegardenIssuer: assertEnvVar("NOISEGARDEN_ISSUER"),
  noisegardenClientId: assertEnvVar("NOISEGARDEN_CLIENT_ID"),
  noisegardenSecret: assertEnvVar("NOISEGARDEN_SECRET"),
  cookieSecret: assertEnvVar("COOKIE_SECRET"),
  resendKey: assertEnvVar("RESEND_KEY"),
  emailSender: process.env["EMAIL_SENDER"] || "onboarding@resend.dev",
  totpSecret: assertEnvVar("TOTP_SECRET"),
  alertsUsername: assertEnvVar("ALERTS_USERNAME"),
  alertsPassword: assertEnvVar("ALERTS_PASSWORD"),
  frontendDSN: new URL(assertEnvVar("FRONTEND_DSN")),
  backendDSN: new URL(assertEnvVar("BACKEND_DSN")),
};

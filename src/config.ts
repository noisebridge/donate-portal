import { isIP } from "node:net";
import dotenv from "dotenv";
import { z } from "zod";
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
    logger.error({ err: e }, "Failed to parse RATE_LIMIT_ALLOW_LIST");
    return [];
  }
  const result = z
    .array(z.string().refine((elem) => isIP(elem) !== 0))
    .safeParse(parsedAllowList);
  if (!result.success) {
    logger.error(
      { err: result.error },
      "RATE_LIMIT_ALLOW_LIST is not an array of IPs",
    );
    return [];
  }

  return result.data;
}

const serverProtocol =
  process.env["NODE_ENV"] === "production" ? "https" : "http";
const serverHost = assertEnvVar("SERVER_HOST");

export default {
  disableRateLimit: process.env["DISABLE_RATE_LIMIT"] === "true",
  // Log emails instead of sending them through Resend (e2e tests).
  disableEmail: process.env["DISABLE_EMAIL"] === "true",
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
  keycloakIssuer: assertEnvVar("KEYCLOAK_ISSUER"),
  keycloakClientId: assertEnvVar("KEYCLOAK_CLIENT_ID"),
  keycloakSecret: assertEnvVar("KEYCLOAK_SECRET"),
  cookieSecret: assertEnvVar("COOKIE_SECRET"),
  resendKey: assertEnvVar("RESEND_KEY"),
  emailSender: process.env["EMAIL_SENDER"] || "onboarding@resend.dev",
  totpSecret: assertEnvVar("TOTP_SECRET"),
  alertsUsername: assertEnvVar("ALERTS_USERNAME"),
  alertsPassword: assertEnvVar("ALERTS_PASSWORD"),
  frontendDSN: new URL(assertEnvVar("FRONTEND_DSN")),
  backendDSN: new URL(assertEnvVar("BACKEND_DSN")),
};

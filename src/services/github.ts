import { z } from "zod";
import config from "~/config";
import baseLogger from "~/lib/logger";
import paths from "~/lib/paths";

const USER_AGENT = "NoisebridgeDonorPortal";
const FETCH_TIMEOUT_MS = 10_000;

const log = baseLogger.child({ module: "github" });

const REDIRECT_URI = `${config.baseUrl}${paths.githubCallback()}`;

/**
 * GitHub answers a bad code with a 200 carrying `error` fields instead of a
 * token, so `access_token` failing to parse is the error path.
 */
const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
});

const userSchema = z.object({
  id: z.number().int(),
  login: z.string(),
});

const emailsSchema = z.array(
  z.object({
    email: z.string(),
    primary: z.boolean(),
    verified: z.boolean(),
  }),
);

/**
 * Build the GitHub OAuth authorization URL
 * @param state - CSRF protection state parameter
 * @param scopes - Array of OAuth scopes to request
 */
export function getAuthorizationUrl(state: string, scopes: string[]) {
  const params = new URLSearchParams({
    client_id: config.githubClientId,
    redirect_uri: REDIRECT_URI,
    state: state,
    scope: scopes.join(" "),
  });

  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange an authorization code for an access token
 * @param code - The authorization code from GitHub
 */
export async function getAccessToken(code: string) {
  const response = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    body: JSON.stringify({
      client_id: config.githubClientId,
      client_secret: config.githubSecret,
      code: code,
      redirect_uri: REDIRECT_URI,
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    log.error(`Failed to get access token: ${response.statusText}`);
    return null;
  }

  const result = tokenResponseSchema.safeParse(await response.json());
  if (!result.success) {
    log.error({ err: result.error }, "No access token in response");
    return null;
  }

  return result.data.access_token;
}

/**
 * Get the authenticated user's profile information
 * @param accessToken - The GitHub access token
 */
export async function getUserProfile(accessToken: string) {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    log.error(`Failed to get user profile: ${response.statusText}`);
    return null;
  }

  const result = userSchema.safeParse(await response.json());
  if (!result.success) {
    log.error({ err: result.error }, "Invalid user profile response");
    return null;
  }

  return result.data;
}

/**
 * Get the authenticated user's email addresses
 * @param accessToken - The GitHub access token
 */
export async function getUserEmails(accessToken: string) {
  const response = await fetch("https://api.github.com/user/emails", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    log.error(`Failed to get user emails: ${response.statusText}`);
    return null;
  }

  const result = emailsSchema.safeParse(await response.json());
  if (!result.success) {
    log.error({ err: result.error }, "Invalid user emails response");
    return null;
  }

  return result.data;
}

/**
 * Get the primary verified email address for a user
 * @param accessToken - The GitHub access token
 */
export async function getPrimaryEmail(accessToken: string) {
  const emails = await getUserEmails(accessToken);
  if (!emails) {
    return null;
  }

  const primaryEmail = emails.find((email) => email.primary && email.verified);
  return primaryEmail?.email || null;
}

/**
 * Complete OAuth flow: exchange code for token and get user info
 * @param code - The authorization code from GitHub
 */
export async function completeFlow(code: string) {
  const accessToken = await getAccessToken(code);
  if (!accessToken) {
    return null;
  }

  const [user, primaryEmail] = await Promise.all([
    getUserProfile(accessToken),
    getPrimaryEmail(accessToken),
  ]);
  if (!user) {
    return null;
  }

  return {
    accessToken,
    user,
    primaryEmail,
  };
}

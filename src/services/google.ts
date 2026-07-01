import config from "~/config";
import baseLogger from "~/lib/logger";
import paths from "~/lib/paths";

const USER_AGENT = "NoisebridgeDonorPortal";
const FETCH_TIMEOUT_MS = 10_000;

const log = baseLogger.child({ module: "google" });

const REDIRECT_URI = `${config.baseUrl}${paths.googleCallback()}`;

interface GoogleTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  id_token?: string;
}

interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name: string;
  family_name: string;
  picture: string;
  locale?: string;
}

/**
 * Build the Google OAuth authorization URL
 * @param state - CSRF protection state parameter
 * @param scopes - Array of OAuth scopes to request
 */
export function getAuthorizationUrl(state: string, scopes: string[]) {
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: scopes.join(" "),
    state: state,
    access_type: "online",
    prompt: "select_account",
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Exchange an authorization code for an access token
 * @param code - The authorization code from Google
 */
export async function getAccessToken(code: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleSecret,
      code: code,
      redirect_uri: REDIRECT_URI,
      grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    const errorText = await response.text();
    log.error(
      { errorText },
      `Failed to get access token: ${response.statusText}`,
    );
    return null;
  }

  const data = (await response.json()) as GoogleTokenResponse;
  if (!data.access_token) {
    log.error("No access token in response");
    return null;
  }

  return data.access_token;
}

/**
 * Get the authenticated user's profile information
 * @param accessToken - The Google access token
 */
export async function getUserInfo(accessToken: string) {
  const response = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "User-Agent": USER_AGENT,
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    },
  );
  if (!response.ok) {
    const errorText = await response.text();
    log.error({ errorText }, `Failed to get user info: ${response.statusText}`);
    return null;
  }

  return (await response.json()) as GoogleUserInfo;
}

/**
 * Complete OAuth flow: exchange code for token and get user info
 * @param code - The authorization code from Google
 * @returns Object containing access token and user info
 */
export async function completeFlow(code: string) {
  const accessToken = await getAccessToken(code);
  if (!accessToken) {
    return null;
  }

  const userInfo = await getUserInfo(accessToken);
  if (!userInfo) {
    return null;
  }

  return {
    accessToken,
    userInfo,
  };
}

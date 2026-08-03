import config from "~/config";
import baseLogger from "~/lib/logger";
import paths from "~/lib/paths";

const USER_AGENT = "NoisebridgeDonorPortal";
const FETCH_TIMEOUT_MS = 10_000;

const log = baseLogger.child({ module: "noisegarden" });

const REDIRECT_URI = `${config.baseUrl}${paths.noisegardenCallback()}`;

/**
 * Keycloak exposes these under the realm issuer. They are derived rather than
 * discovered: fetching /.well-known/openid-configuration on every sign-in
 * would add a network round-trip to the critical path for endpoints that have
 * been stable across Keycloak majors.
 */
const AUTHORIZE_URL = `${config.noisegardenIssuer}/protocol/openid-connect/auth`;
const TOKEN_URL = `${config.noisegardenIssuer}/protocol/openid-connect/token`;
const USERINFO_URL = `${config.noisegardenIssuer}/protocol/openid-connect/userinfo`;

interface NoisegardenTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
  id_token?: string;
}

/**
 * The subset of Keycloak's userinfo response this app relies on. `sub` is the
 * stable account id; `email_verified` is load-bearing — see completeFlow.
 */
interface NoisegardenUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
}

/**
 * Build the authorization URL for the noisegarden (Keycloak) realm.
 *
 * No PKCE, matching the GitHub and Google flows in this app: this is a
 * confidential client whose secret never leaves the server, and CSRF is
 * covered by the signed state cookie the caller sets. Adding PKCE would mean
 * carrying a verifier in OAuthDataSchema, which is shared with the other two
 * providers.
 *
 * @param state - CSRF protection state parameter
 * @param scopes - Array of OAuth scopes to request
 */
export function getAuthorizationUrl(state: string, scopes: string[]) {
  const params = new URLSearchParams({
    client_id: config.noisegardenClientId,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: scopes.join(" "),
    state: state,
  });

  return `${AUTHORIZE_URL}?${params.toString()}`;
}

/**
 * Exchange an authorization code for an access token.
 * @param code - The authorization code from Keycloak
 */
export async function getAccessToken(code: string) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({
      client_id: config.noisegardenClientId,
      client_secret: config.noisegardenSecret,
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

  const data = (await response.json()) as NoisegardenTokenResponse;
  return data.access_token;
}

/**
 * Fetch the account profile for an access token.
 * @param accessToken - A token from {@linkcode getAccessToken}
 */
export async function getUserInfo(accessToken: string) {
  const response = await fetch(USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "User-Agent": USER_AGENT,
    },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) {
    const errorText = await response.text();
    log.error({ errorText }, `Failed to get user info: ${response.statusText}`);
    return null;
  }

  return (await response.json()) as NoisegardenUserInfo;
}

/**
 * Run the whole authorization-code flow for a callback code.
 *
 * Returns null on any failure so the caller redirects to a generic error
 * rather than leaking which step failed.
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

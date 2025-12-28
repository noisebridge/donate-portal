import config from "~/config";
import { baseLogger } from "~/logger";

const userAgent = "NoisebridgeDonorPortal";

interface GitHubTokenResponse {
  access_token: string;
  token_type: string;
  scope: string;
}

interface GitHubUser {
  id: number;
  login: string;
  email: string | null;
  name: string | null;
  avatar_url: string;
}

interface GitHubEmail {
  email: string;
  primary: boolean;
  verified: boolean;
  visibility: string | null;
}

/**
 * GitHubOAuth service for handling GitHub OAuth authentication
 */
export class GitHubOAuth {
  static readonly log = baseLogger.child({ class: "GitHubOAuth" });
  static readonly redirectUri =
    `${config.serverProtocol}://${config.serverHost}/auth/github/callback`;

  /**
   * Build the GitHub OAuth authorization URL
   * @param state - CSRF protection state parameter
   * @param scopes - Array of OAuth scopes to request (defaults to user:email)
   */
  getAuthorizationUrl(state: string, scopes: string[]): string {
    const params = new URLSearchParams({
      client_id: config.githubClientId,
      redirect_uri: GitHubOAuth.redirectUri,
      state: state,
      scope: scopes.join(" "),
    });

    return `https://github.com/login/oauth/authorize?${params.toString()}`;
  }

  /**
   * Exchange an authorization code for an access token
   * @param code - The authorization code from GitHub
   */
  async getAccessToken(code: string): Promise<string> {
    const response = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": userAgent,
        },
        body: JSON.stringify({
          client_id: config.githubClientId,
          client_secret: config.githubSecret,
          code: code,
          redirect_uri: GitHubOAuth.redirectUri,
        }),
      },
    );
    if (!response.ok) {
      throw new Error(`Failed to get access token: ${response.statusText}`);
    }

    const data = (await response.json()) as GitHubTokenResponse;
    if (!data.access_token) {
      throw new Error("No access token in response");
    }

    return data.access_token;
  }

  /**
   * Get the authenticated user's profile information
   * @param accessToken - The GitHub access token
   */
  async getUserProfile(accessToken: string): Promise<GitHubUser> {
    const response = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": userAgent,
      },
    });
    if (!response.ok) {
      throw new Error(`Failed to get user profile: ${response.statusText}`);
    }

    return (await response.json()) as GitHubUser;
  }

  /**
   * Get the authenticated user's email addresses
   * @param accessToken - The GitHub access token
   */
  async getUserEmails(accessToken: string): Promise<GitHubEmail[] | null> {
    const response = await fetch("https://api.github.com/user/emails", {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": userAgent,
      },
    });
    if (!response.ok) {
      GitHubOAuth.log.error(
        `Failed to get user emails: ${response.statusText}`,
      );
      return null;
    }

    return (await response.json()) as GitHubEmail[];
  }

  /**
   * Get the primary verified email address for a user
   * @param accessToken - The GitHub access token
   */
  async getPrimaryEmail(accessToken: string): Promise<string | null> {
    const emails = await this.getUserEmails(accessToken);
    if (!emails) {
      return null;
    }

    const primaryEmail = emails.find(
      (email) => email.primary && email.verified,
    );
    return primaryEmail?.email || null;
  }

  /**
   * Complete OAuth flow: exchange code for token and get user info
   * @param code - The authorization code from GitHub
   * @returns Object containing access token, user profile, and primary email
   */
  async completeOAuthFlow(code: string): Promise<{
    accessToken: string;
    user: GitHubUser;
    primaryEmail: string | null;
  }> {
    const accessToken = await this.getAccessToken(code);
    const [user, primaryEmail] = await Promise.all([
      this.getUserProfile(accessToken),
      this.getPrimaryEmail(accessToken),
    ]);

    return {
      accessToken,
      user,
      primaryEmail,
    };
  }
}

// Create and export a singleton instance
const githubOAuth = new GitHubOAuth();
export default githubOAuth;

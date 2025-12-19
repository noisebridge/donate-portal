// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";
import { ErrorBanner } from "~/components/error-banner";
import { Layout } from "~/components/layout";

export interface AuthProps {
  isAuthenticated: boolean;
  error?: string | undefined;
}

export function AuthPage({ isAuthenticated, error }: AuthProps) {
  return (
    <Layout title="Sign In" styles="auth.css" isAuthenticated={isAuthenticated}>
      <ErrorBanner error={error} />
      <div class="auth-card">
        <h1 class="auth-title">Sign In</h1>
        <p class="auth-subtitle">Sign in to manage your monthly donation</p>

        <div class="oauth-buttons">
          <a href="/auth/github/start" class="btn btn-auth btn-github">
            <img
              class="oauth-icon"
              src="/assets/image/github.svg"
              alt="GitHub Logo"
            />
            Continue with GitHub
          </a>

          <a href="/auth/google/start" class="btn btn-auth btn-google">
            <img
              class="oauth-icon"
              src="/assets/image/google.svg"
              alt="Google Logo"
            />
            Continue with Google
          </a>
        </div>

        <div class="divider">
          <span class="divider-text">or</span>
        </div>

        <div class="magic-link-section">
          <h2 class="magic-link-title">Sign in with Email</h2>
          <p class="magic-link-description">We'll send you a link to sign in</p>

          <form class="magic-link-form" method="post" action="/auth/email">
            <div class="form-group">
              <input
                type="email"
                id="email"
                name="email"
                class="form-input"
                placeholder="you@example.com"
                minlength="5"
                required
              />
            </div>

            <button class="btn btn-auth btn-block" type="submit">
              Send Magic Link
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}

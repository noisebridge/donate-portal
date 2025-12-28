// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";
import { Layout } from "~/components/layout";
import {
  type Notification,
  NotificationContainer,
} from "~/components/notification-container";

export interface AuthProps {
  isAuthenticated: boolean;
  notifications?: Notification[];
}

export function AuthPage({ isAuthenticated, notifications = [] }: AuthProps) {
  return (
    <Layout
      title="Sign In"
      styles="auth.css"
      script="auth.mjs"
      isAuthenticated={isAuthenticated}
    >
      <NotificationContainer notifications={notifications} />
      <div class="auth-card">
        <h1 class="auth-title">Sign In</h1>
        <p class="auth-subtitle">Sign in to manage your monthly donation</p>

        <div class="oauth-buttons">
          <a href="/auth/github/start" class="btn btn-outline btn-github">
            <img
              class="oauth-icon"
              src="/assets/image/github.svg"
              alt="GitHub Logo"
            />
            Continue with GitHub
          </a>

          <a href="/auth/google/start" class="btn btn-outline btn-google">
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

            <button class="btn btn-outline btn-block" type="submit">
              Send Magic Link
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}

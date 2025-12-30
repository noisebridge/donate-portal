import { Layout } from "~/components/layout";
import { type Message, MessageContainer } from "~/components/message-container";
import paths from "~/paths";

export interface AuthProps {
  isAuthenticated: boolean;
  messages?: Message[];
}

export function AuthPage({ isAuthenticated, messages = [] }: AuthProps) {
  return (
    <Layout
      title="Sign In"
      styles="auth.css"
      script="auth.mjs"
      isAuthenticated={isAuthenticated}
    >
      <div class="container-narrow">
        <MessageContainer messages={messages} />

        <div class="card">
          <h1 class="auth-title">Sign In</h1>
          <p class="auth-subtitle">Sign in to manage your monthly donation</p>

          <div class="oauth-buttons">
            <a href={paths.githubStart()} class="btn btn-outline btn-github">
              <img
                class="oauth-icon"
                src="/assets/image/github.svg"
                alt="GitHub Logo"
              />
              Continue with GitHub
            </a>

            <a href={paths.googleStart()} class="btn btn-outline btn-google">
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
            <p class="magic-link-description">
              We'll send you a link to sign in
            </p>

            <form
              class="magic-link-form"
              method="post"
              action={paths.emailAuth()}
            >
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
      </div>
    </Layout>
  );
}

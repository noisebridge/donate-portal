// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";
import { Layout } from "~/components/layout";

export interface AuthProps {
  title: string;
}

export function AuthPage({ title }: AuthProps) {
  return (
    <Layout title={title} styles="auth.css">
      <section class="auth-container">
        <div class="auth-card">
          <h1 class="auth-title">Sign In</h1>
          <p class="auth-subtitle">Sign in to manage your monthly donation</p>

          <div class="oauth-buttons">
            <button class="btn btn-oauth btn-github" type="button">
              <img class="oauth-icon" src="/assets/image/github.svg" alt="GitHub Logo" />
              Continue with GitHub
            </button>

            <button class="btn btn-oauth btn-google" type="button">
              <img class="oauth-icon" src="/assets/image/google.svg" alt="Google Logo" />
              Continue with Google
            </button>
          </div>

          <div class="divider">
            <span class="divider-text">or</span>
          </div>

          <div class="magic-link-section">
            <h2 class="magic-link-title">Sign in with Email</h2>
            <p class="magic-link-description">We'll send you a link to sign in</p>

            <form class="magic-link-form" method="post" action="/auth/magic-link">
              <div class="form-group">
                <input
                  type="email"
                  id="email"
                  name="email"
                  class="form-input"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <button class="btn btn-primary btn-block" type="submit">
                Send Magic Link
              </button>
            </form>
          </div>
        </div>
      </section>
    </Layout>
  );
}

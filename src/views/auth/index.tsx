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
      <main class="stage">
        <div class="center-col">
          <MessageContainer messages={messages} />

          <div class="center-intro">
            <h1>
              Welcome <span class="accent">back</span>
              <span class="cursor"></span>
            </h1>
          </div>

          <div class="form-card">
            <div class="card-head">
              <div>~/auth/sign_in</div>
            </div>

            <h2>sign_in</h2>
            <p class="sub">
              Pick a provider, or we'll email you a one-time link.
            </p>

            <div class="oauth-stack">
              <a href={paths.googleStart()} class="btn-oauth">
                <span class="oauth-ico" aria-hidden="true">
                  <img
                    src="/assets/image/google.svg"
                    alt=""
                    width="18"
                    height="18"
                  />
                </span>
                <span>Continue with Google</span>
                <span class="arrow">{"→"}</span>
              </a>

              <a href={paths.githubStart()} class="btn-oauth">
                <span class="oauth-ico" aria-hidden="true">
                  <img
                    src="/assets/image/github.svg"
                    alt=""
                    width="18"
                    height="18"
                  />
                </span>
                <span>Continue with GitHub</span>
                <span class="arrow">{"→"}</span>
              </a>
            </div>

            <div class="divider">or email me a link</div>

            <form method="post" action={paths.emailAuth()}>
              <div class="field">
                <label for="email">Email</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="you@domain.tld"
                  minlength="5"
                  required
                  autocomplete="email"
                />
              </div>

              <button type="submit" class="btn-signin">
                <span>Send magic link</span>
                <span>{"→"}</span>
              </button>

              <div class="magic-note">
                We'll email a one-time sign-in link. No password required.
              </div>
            </form>
          </div>
        </div>
      </main>
    </Layout>
  );
}

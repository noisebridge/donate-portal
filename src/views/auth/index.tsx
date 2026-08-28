import { Button } from "~/components/button";
import { Layout } from "~/components/layout";
import { type Message, MessageContainer } from "~/components/message-container";
import paths from "~/lib/paths";

export interface AuthProps {
  isAuthenticated: boolean;
  messages?: Message[];
  csrfToken?: string | undefined;
}

export function AuthPage({
  isAuthenticated,
  messages = [],
  csrfToken,
}: AuthProps) {
  return (
    <Layout
      title="Sign In"
      styles="auth.css"
      script="auth.mjs"
      isAuthenticated={isAuthenticated}
      csrfToken={csrfToken}
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

          <div class="form-card offset-frame">
            <div class="card-head">
              <div>~/auth/sign_in</div>
            </div>

            <h2>sign_in</h2>
            <p class="sub">
              Pick a provider, or we'll email you a one-time link.
            </p>

            <div class="oauth-stack">
              <Button
                variant="outline"
                arrow
                href={paths.googleStart()}
                icon={
                  <img
                    src={paths.assetWithHash("image/google.svg")}
                    alt=""
                    width="18"
                    height="18"
                  />
                }
              >
                Continue with Google
              </Button>

              <Button
                variant="outline"
                arrow
                href={paths.githubStart()}
                icon={
                  <img
                    src={paths.assetWithHash("image/github.svg")}
                    alt=""
                    width="18"
                    height="18"
                  />
                }
              >
                Continue with GitHub
              </Button>

              <Button
                variant="outline"
                arrow
                href={paths.keycloakStart()}
                icon={
                  <img
                    src={paths.assetWithHash("image/logo.svg")}
                    alt=""
                    width="18"
                    height="18"
                  />
                }
              >
                Continue with Noisebridge
              </Button>
            </div>

            <div class="divider">or email me a link</div>

            <form method="post" action={paths.emailAuth()}>
              <input type="hidden" name="_csrf" value={csrfToken} />
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

              <Button variant="primary" arrow type="submit">
                Send magic link
              </Button>

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

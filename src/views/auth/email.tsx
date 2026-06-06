import { escapeHtml } from "@kitajs/html";
import { Layout } from "~/components/layout";
import paths from "~/lib/paths";

export interface AuthEmailProps {
  email: string;
  isAuthenticated: boolean;
  csrfToken?: string | undefined;
}

export function AuthEmailPage({
  email,
  isAuthenticated,
  csrfToken,
}: AuthEmailProps) {
  return (
    <Layout
      title="Check Your Email"
      styles="auth.css"
      isAuthenticated={isAuthenticated}
      csrfToken={csrfToken}
    >
      <main class="stage">
        <div class="center-col">
          <div class="sent-card offset-frame">
            <img
              class="sent-glyph"
              src={paths.assetWithHash("image/email.svg")}
              alt=""
              width="60"
              height="44"
            />

            <h1>Check your email</h1>
            <p>
              We sent a sign-in link to{" "}
              <span class="sent-email">{escapeHtml(email)}</span>. Click it to
              finish — no password needed.
            </p>
            <p>The link expires in 5 minutes.</p>

            <div class="sent-meta">
              <span>Didn't arrive? Check spam</span>
              <span class="dot"></span>
              <span>or wait a moment :D</span>
            </div>
          </div>

          <a class="sent-back" href={paths.signIn()}>
            ← Use a different email
          </a>
        </div>
      </main>
    </Layout>
  );
}

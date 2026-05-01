import { escapeHtml } from "@kitajs/html";
import { Layout } from "~/components/layout";

export type ErrorPageProps = {
  error: Error;
  isAuthenticated: boolean;
  csrfToken?: string | undefined;
};

export function ErrorPage({
  error,
  isAuthenticated,
  csrfToken,
}: ErrorPageProps) {
  return (
    <Layout
      title="Error"
      styles="error.css"
      isAuthenticated={isAuthenticated}
      csrfToken={csrfToken}
    >
      <div class="container">
        <div class="error-page">
          <h1 class="error-heading">fatal_error</h1>

          <div class="error-details">
            <div class="error-message">
              <h2>Message</h2>
              <pre>{escapeHtml(error.message)}</pre>
            </div>

            {!!error.stack && (
              <div class="error-stack">
                <h2>Stack trace</h2>
                <pre>{escapeHtml(error.stack)}</pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

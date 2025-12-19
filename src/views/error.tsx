// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";
import { Layout } from "~/components/layout";
import config from "~/config";

export type ErrorPageProps = {
  error: Error;
  isAuthenticated?: boolean;
};

export function ErrorPage({ error, isAuthenticated = false }: ErrorPageProps) {
  return (
    <Layout title="Error" styles="error.css" isAuthenticated={isAuthenticated}>
      <div class="error-page">
        <h1 class="error-heading">Oops! Something went wrong</h1>

        {!config.production ? (
          <div class="error-details">
            <div class="error-message">
              <h2>Error Message:</h2>
              <pre>{error.message}</pre>
            </div>

            {error.stack && (
              <div class="error-stack">
                <h2>Stack Trace:</h2>
                <pre>{error.stack}</pre>
              </div>
            )}
          </div>
        ) : (
          <div class="error-production">
            <p class="error-description">
              We're sorry, but something went wrong on our end. Please try again
              later.
            </p>
          </div>
        )}
      </div>
    </Layout>
  );
}

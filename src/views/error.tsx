import { Layout } from "~/components/layout";

export type ErrorPageProps = {
  error: Error;
  isAuthenticated: boolean;
};

export function ErrorPage({ error, isAuthenticated }: ErrorPageProps) {
  return (
    <Layout title="Error" styles="error.css" isAuthenticated={isAuthenticated}>
      <div class="container">
        <div class="error-page">
          <h1 class="error-heading">Oops! Something went wrong</h1>

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
        </div>
      </div>
    </Layout>
  );
}

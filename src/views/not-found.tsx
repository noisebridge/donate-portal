import { Button } from "~/components/button";
import { Layout } from "~/components/layout";
import paths from "~/lib/paths";

export interface NotFoundProps {
  isAuthenticated: boolean;
  csrfToken?: string | undefined;
}

export function NotFoundPage({ isAuthenticated, csrfToken }: NotFoundProps) {
  return (
    <Layout
      title="Page Not Found"
      styles="error.css"
      isAuthenticated={isAuthenticated}
      csrfToken={csrfToken}
    >
      <div class="container">
        <div class="error-page not-found">
          <h1 class="error-heading">page_not_found</h1>
          <p class="error-lede">
            The page you're looking for doesn't exist or has moved.
          </p>
          <Button variant="primary" arrow href={paths.index()}>
            Back to donations
          </Button>
        </div>
      </div>
    </Layout>
  );
}

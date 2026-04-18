import { Layout } from "~/components/layout";

export interface NotFoundProps {
  isAuthenticated: boolean;
}

export function NotFoundPage({ isAuthenticated }: NotFoundProps) {
  return (
    <Layout
      title="Page Not Found"
      styles="error.css"
      isAuthenticated={isAuthenticated}
    >
      <div class="container">
        <div class="error-page">
          <h1 class="error-heading">page_not_found</h1>
        </div>
      </div>
    </Layout>
  );
}

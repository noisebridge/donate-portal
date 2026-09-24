import { escapeHtml } from "@kitajs/html";
import { Layout } from "~/components/layout";
import type { FriendlyError } from "~/lib/friendly-error";

export type FriendlyErrorPageProps = {
  error: FriendlyError;
  isAuthenticated: boolean;
  csrfToken?: string | undefined;
};

export function FriendlyErrorPage({
  error,
  isAuthenticated,
  csrfToken,
}: FriendlyErrorPageProps) {
  return (
    <Layout
      title="Error"
      styles="error.css"
      isAuthenticated={isAuthenticated}
      csrfToken={csrfToken}
    >
      <div class="container">
        <div class="error-page">
          <h1 class="error-heading">something_went_wrong</h1>

          <div class="error-details">
            <h2 class="error-title">{escapeHtml(error.title)}</h2>
            <p class="error-description">{escapeHtml(error.description)}</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

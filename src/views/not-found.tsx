// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";
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
      <div class="error-page">
        <h1 class="error-heading">Page Not Found</h1>
      </div>
    </Layout>
  );
}

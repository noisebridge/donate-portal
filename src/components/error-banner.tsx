// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";

export interface ErrorBannerProps {
  error?: string | undefined;
}

export function ErrorBanner({ error }: ErrorBannerProps) {
  if (!error) return null;

  return (
    <div class="error-banner" role="alert">
      <span class="error-message">{error}</span>
    </div>
  );
}

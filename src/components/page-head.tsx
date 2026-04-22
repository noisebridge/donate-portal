import { escapeHtml } from "@kitajs/html";

export interface PageHeadProps {
  title: string;
}

export function PageHead({ title }: PageHeadProps) {
  return (
    <header class="page-head">
      <h1>{escapeHtml(title)}</h1>
    </header>
  );
}

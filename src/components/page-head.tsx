import { escapeHtml } from "@kitajs/html";
import paths from "~/paths";

export interface PageHeadProps {
  title: string;
  crumbs: string[];
}

export function PageHead({ title, crumbs }: PageHeadProps) {
  const lastIndex = crumbs.length - 1;
  return (
    <header class="page-head">
      <h1>{escapeHtml(title)}</h1>
      <div class="crumbs">
        <a href={paths.index()}>~</a>
        {crumbs.map((crumb, i) => (
          <>
            <span class="sep">/</span>
            {i === lastIndex ? (
              <span class="crumb-current">{escapeHtml(crumb)}</span>
            ) : (
              escapeHtml(crumb)
            )}
          </>
        ))}
      </div>
    </header>
  );
}

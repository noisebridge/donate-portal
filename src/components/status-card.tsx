import type { PropsWithChildren } from "@kitajs/html";
import { escapeHtml } from "@kitajs/html";

export type StatusCardProps = PropsWithChildren<{
  icon: JSX.Element;
  title: string;
}>;

export function StatusCard({ icon, title, children }: StatusCardProps) {
  return (
    <div class="container-narrow">
      <div class="card text-center">
        <div class="page-icon-wrapper">{icon as "safe"}</div>

        <h1 class="page-title">{escapeHtml(title)}</h1>

        {children}
      </div>
    </div>
  );
}

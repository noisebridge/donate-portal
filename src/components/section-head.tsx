import { escapeHtml } from "@kitajs/html";

export interface SectionHeadProps {
  title: string;
  meta?: string;
}

export function SectionHead({ title, meta }: SectionHeadProps) {
  return (
    <div class="section-head">
      <h2>{escapeHtml(title)}</h2>
      {meta ? <span class="meta">{escapeHtml(meta)}</span> : null}
    </div>
  );
}

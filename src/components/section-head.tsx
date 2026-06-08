import { escapeHtml } from "@kitajs/html";

export interface SectionHeadProps {
  title: string;
  meta?: string;
  anchor?: string;
}

export function SectionHead({ title, meta, anchor }: SectionHeadProps) {
  return (
    <div id={anchor} class="section-head">
      <h2>{escapeHtml(title)}</h2>
      {meta ? <span class="meta">{escapeHtml(meta)}</span> : null}
    </div>
  );
}

export interface SectionHeadProps {
  title: string;
  meta?: string;
  anchor?: string;
}

export function SectionHead({ title, meta, anchor }: SectionHeadProps) {
  return (
    <div id={anchor} class="section-head">
      <h2>{title}</h2>
      {meta ? <span class="meta">{meta}</span> : null}
    </div>
  );
}

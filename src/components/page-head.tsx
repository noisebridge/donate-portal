export interface PageHeadProps {
  title: string;
}

export function PageHead({ title }: PageHeadProps) {
  return (
    <header class="page-head">
      <h1>{title}</h1>
    </header>
  );
}

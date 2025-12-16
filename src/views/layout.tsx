import type { PropsWithChildren } from "@kitajs/html";
// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";

export type LayoutProps = PropsWithChildren<{
  title: string;
  script: string;
}>;

export function Layout({ title, script, children }: LayoutProps) {
  return (
    <>
      {"<!DOCTYPE html>"}
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <title>{title}</title>
          <link rel="icon" href="/assets/image/favicon.svg" />
          <link rel="stylesheet" href="/assets/css/main.css" />
          <script type="module" src={`/assets/js/${script}`}></script>
        </head>
        <body>
          {children}
        </body>
      </html>
    </>
  );
}

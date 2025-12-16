import type { PropsWithChildren } from "@kitajs/html";
// biome-ignore lint/correctness/noUnusedImports: Html is used by JSX
import Html from "@kitajs/html";

export type LayoutProps = PropsWithChildren<{
  title: string;
  script?: string;
  styles?: string;
}>;

export function Layout({ title, script, styles, children }: LayoutProps) {
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
          <link rel="stylesheet" href="/assets/css/reset.css" />
          <link rel="stylesheet" href="/assets/css/main.css" />
          <script type="module" src="/assets/js/main.mjs"></script>
          {styles && <link rel="stylesheet" href={`/assets/css/${styles}`} />}
          {script && <script type="module" src={`/assets/js/${script}`}></script>}
        </head>
        <body>
          <nav class="navbar">
            <div class="container">
              <div class="navbar-content">
                <div class="navbar-left">
                  <a href="/" class="navbar-brand">
                    <img src="/assets/image/logo.svg" alt="Noisebridge" class="logo" />
                    <span class="site-title">Noisebridge Hacker Space</span>
                  </a>
                </div>
                <div class="navbar-right">
                  <a href="/auth" class="btn-sign-in">Sign In</a>
                </div>
              </div>
            </div>
          </nav>
          <main class="main-content">
            <div class="container">
              {children}
            </div>
          </main>
          <footer class="footer">
            <div class="container">
              <p class="footer-text">Noisebridge is a 501(c)(3) non-profit. Our EIN is 26-3507741</p>
            </div>
          </footer>
        </body>
      </html>
    </>
  );
}

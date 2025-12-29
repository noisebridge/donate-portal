import type { PropsWithChildren } from "@kitajs/html";
import config from "~/config";
import Navbar from "./navbar";

const githubUrl =
  config.gitRepo &&
  config.gitCommit &&
  `https://github.com/${config.gitRepo}/tree/${config.gitCommit}`;

export type LayoutProps = PropsWithChildren<{
  title: string;
  script?: string;
  styles?: string;
  isAuthenticated: boolean;
}>;

export function Layout({
  title,
  script,
  styles,
  isAuthenticated,
  children,
}: LayoutProps) {
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
          <title>{title} | Noisebridge</title>
          <link rel="icon" href="/assets/image/favicon.svg" />
          <link rel="stylesheet" href="/assets/css/reset.css" />
          <link rel="stylesheet" href="/assets/css/main.css" />
          {styles && <link rel="stylesheet" href={`/assets/css/${styles}`} />}
          {script && (
            <script type="module" src={`/assets/js/${script}`}></script>
          )}
        </head>
        <body>
          <Navbar isAuthenticated={isAuthenticated} />

          <main class="main-content">{children}</main>

          <footer>
            <p>
              Noisebridge is a 501(c)(3) non-profit
              {githubUrl && (
                <>
                  {" &mdash; "}
                  <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                    Source Code
                  </a>
                </>
              )}
            </p>
          </footer>
        </body>
      </html>
    </>
  );
}

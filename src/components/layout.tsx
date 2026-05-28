import type { PropsWithChildren } from "@kitajs/html";
import config from "~/config";
import { assetPath, importMapJson } from "~/paths";
import { Navbar } from "./navbar";

const githubUrl =
  config.gitRepo &&
  config.gitCommit &&
  (`https://github.com/${config.gitRepo}/tree/${config.gitCommit}` as "safe");

const description =
  "Support Noisebridge, San Francisco's anarchist hackerspace. Donate to help keep the space open and accessible to all.";

export type LayoutProps = PropsWithChildren<{
  title: string;
  description?: string;
  script?: string;
  styles?: string;
  isAuthenticated: boolean;
  csrfToken?: string | undefined;
}>;

export function Layout({
  title,
  script,
  styles,
  isAuthenticated,
  csrfToken,
  children,
}: LayoutProps) {
  return (
    <>
      {"<!DOCTYPE html>"}
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          {/** Prevent Safari from turning our EIN into a phone number link */}
          <meta name="format-detection" content="telephone=no" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <meta name="description" content={description} />
          <meta name="theme-color" content="#000000" />
          <meta name="stripe-public" content={config.stripePublicKey} />
          <title>{title as "safe"} | Noisebridge</title>

          <meta property="og:type" content="website" />
          <meta property="og:locale" content="en_US" />
          <meta property="og:site_name" content="Noisebridge" />
          <meta property="og:title" content={`${title} | Noisebridge`} />
          <meta property="og:description" content={description} />
          <meta
            property="og:image"
            content={`${config.baseUrl}${assetPath("image/logo.svg")}`}
          />

          <meta name="twitter:card" content="summary" />
          <meta name="twitter:title" content={`${title} | Noisebridge`} />
          <meta name="twitter:description" content={description} />
          <meta
            name="twitter:image"
            content={`${config.baseUrl}${assetPath("image/logo.svg")}`}
          />

          <link rel="icon" href={assetPath("image/favicon.svg")} />
          {/**
           * Hide all content initially. This style is reset at the end of
           * main.css to prevent a flash-of-unstyled-content.
           */}
          <style>{"html { visibility: hidden; opacity: 0; }"}</style>
          <link rel="stylesheet" href={assetPath("css/reset.css")} />
          <link rel="stylesheet" href={assetPath("css/main.css")} />
          {!!styles && (
            <link rel="stylesheet" href={assetPath(`css/${styles}`)} />
          )}
          <script type="importmap">{importMapJson}</script>
          <script
            type="module"
            src={assetPath("js/util/error-reporting.mjs")}
          ></script>
          {!!script && (
            <script type="module" src={assetPath(`js/${script}`)}></script>
          )}
        </head>
        <body>
          <Navbar isAuthenticated={isAuthenticated} csrfToken={csrfToken} />

          <main id="main-content">{children}</main>

          <footer>
            <div class="footer-content">
              <div>
                {"&copy;"} {new Date().getFullYear()} Noisebridge
              </div>
              {githubUrl && (
                <div>
                  <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                    Source
                  </a>
                </div>
              )}
            </div>
          </footer>
        </body>
      </html>
    </>
  );
}

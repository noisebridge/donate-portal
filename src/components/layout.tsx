import type { PropsWithChildren } from "@kitajs/html";
import config from "~/config";
import { importMapJson } from "~/lib/import-map";
import paths from "~/lib/paths";
import { Navbar } from "./navbar";

const githubUrl =
  config.gitRepo &&
  config.gitCommit &&
  (`https://github.com/${config.gitRepo}/tree/${config.gitCommit}` as "safe");

const defaultDescription =
  "Support Noisebridge, San Francisco's anarchist hackerspace. Donate to help keep the space open and accessible to all.";

export const layoutStyleBody = "html { visibility: hidden; opacity: 0; }";

export type LayoutProps = PropsWithChildren<{
  title: string;
  titleSuffix?: string;
  description?: string;
  favicon?: string;
  socialImage?: string;
  themeColor?: string;
  script?: string;
  styles?: string;
  bare?: boolean;
  isAuthenticated: boolean;
  csrfToken?: string | undefined;
}>;

export function Layout({
  title,
  titleSuffix = " | Noisebridge",
  description = defaultDescription,
  favicon = "image/favicon.svg",
  socialImage = "image/logo.svg",
  themeColor = "#000000",
  script,
  styles,
  bare = false,
  isAuthenticated,
  csrfToken,
  children,
}: LayoutProps) {
  const documentTitle = `${title}${titleSuffix}`;

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
          <meta name="theme-color" content={themeColor} />
          <meta name="stripe-public" content={config.stripePublicKey} />
          <title>{documentTitle as "safe"}</title>

          <meta property="og:type" content="website" />
          <meta property="og:locale" content="en_US" />
          <meta property="og:site_name" content="Noisebridge" />
          <meta property="og:title" content={documentTitle} />
          <meta property="og:description" content={description} />
          <meta
            property="og:image"
            content={`${config.baseUrl}${paths.assetWithHash(socialImage)}`}
          />

          <meta name="twitter:card" content="summary" />
          <meta name="twitter:title" content={documentTitle} />
          <meta name="twitter:description" content={description} />
          <meta
            name="twitter:image"
            content={`${config.baseUrl}${paths.assetWithHash(socialImage)}`}
          />

          <link rel="icon" href={paths.assetWithHash(favicon)} />
          {!bare && (
            <>
              {/**
               * Hide all content initially. This style is reset at the end of
               * main.css to prevent a flash-of-unstyled-content.
               */}
              <style>{layoutStyleBody}</style>
            </>
          )}
          {!bare && (
            <>
              <link
                rel="preload"
                href={paths.asset("font/inter/latin.woff2")}
                as="font"
                type="font/woff2"
                crossorigin="anonymous"
              />
              <link
                rel="preload"
                href={paths.asset("font/jetbrains_mono/latin_normal.woff2")}
                as="font"
                type="font/woff2"
                crossorigin="anonymous"
              />
            </>
          )}
          <link rel="stylesheet" href={paths.assetWithHash("css/reset.css")} />
          {!bare && (
            <link rel="stylesheet" href={paths.assetWithHash("css/main.css")} />
          )}
          {!!styles && (
            <link
              rel="stylesheet"
              href={paths.assetWithHash(`css/${styles}`)}
            />
          )}
          <script type="importmap">{importMapJson}</script>
          <script
            type="module"
            src={paths.assetWithHash("js/util/error-reporting.mjs")}
          ></script>
          {!!script && (
            <script
              type="module"
              src={paths.assetWithHash(`js/${script}`)}
            ></script>
          )}
        </head>
        <body>
          {!bare && (
            <Navbar isAuthenticated={isAuthenticated} csrfToken={csrfToken} />
          )}

          <main id="main-content">{children}</main>

          {!bare && (
            <footer>
              <div class="footer-content">
                <div>
                  {"&copy;"} {new Date().getFullYear()} Noisebridge
                </div>
                {githubUrl && (
                  <a href={githubUrl} target="_blank" rel="noopener noreferrer">
                    Source
                  </a>
                )}
              </div>
            </footer>
          )}
        </body>
      </html>
    </>
  );
}

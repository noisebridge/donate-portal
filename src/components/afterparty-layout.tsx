import type { PropsWithChildren } from "@kitajs/html";
import config from "~/config";
import { importMapJson } from "~/lib/import-map";
import paths from "~/lib/paths";
import { EVENT_DESCRIPTION } from "~/managers/ticketing";

const title = "Noisebridge's Unofficial Open Sauce Afterparty";

export function AfterpartyLayout({ children }: PropsWithChildren) {
  const socialImage = `${config.baseUrl}${paths.assetWithHash("image/afterparty-logo.svg")}`;

  return (
    <>
      {"<!DOCTYPE html>"}
      <html lang="en">
        <head>
          <meta charset="UTF-8" />
          <meta name="format-detection" content="telephone=no" />
          <meta
            name="viewport"
            content="width=device-width, initial-scale=1.0"
          />
          <meta name="description" content={EVENT_DESCRIPTION} />
          <meta name="theme-color" content="#FF0000" />
          <meta name="stripe-public" content={config.stripePublicKey} />
          <title>{title}</title>

          <meta property="og:type" content="website" />
          <meta property="og:locale" content="en_US" />
          <meta property="og:site_name" content="Noisebridge" />
          <meta property="og:title" content={title} />
          <meta property="og:description" content={EVENT_DESCRIPTION} />
          <meta property="og:image" content={socialImage} />

          <meta name="twitter:card" content="summary" />
          <meta name="twitter:title" content={title} />
          <meta name="twitter:description" content={EVENT_DESCRIPTION} />
          <meta name="twitter:image" content={socialImage} />

          <link
            rel="icon"
            href={paths.assetWithHash("image/afterparty-favicon.svg")}
          />
          <link rel="stylesheet" href={paths.assetWithHash("css/reset.css")} />
          <link
            rel="stylesheet"
            href={paths.assetWithHash("css/afterparty.css")}
          />
          <script type="importmap">{importMapJson}</script>
          <script
            type="module"
            src={paths.assetWithHash("js/util/error-reporting.mjs")}
          ></script>
          <script
            type="module"
            src={paths.assetWithHash("js/afterparty.mjs")}
          ></script>
        </head>
        <body>
          <main id="main-content">{children}</main>
        </body>
      </html>
    </>
  );
}

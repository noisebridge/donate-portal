import { escapeHtml } from "@kitajs/html";
import type { ChargeAlertMessage } from "~/managers/charge-alert";
import { formatAmount } from "~/money";
import paths from "~/paths";

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleString("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    timeZone: "America/Los_Angeles",
  });
}

function NiceBadge() {
  return <span class="nice-badge">NICE</span>;
}

function isNice(amount: { cents: number }): boolean {
  return amount.cents % 100 === 69;
}

function HistoryItem({ charge }: { charge: ChargeAlertMessage }) {
  const [dollars, cents] = formatAmount(charge.amount).split(".");

  return (
    <div
      class="history-item"
      data-alert-id={charge.id}
      data-amount={String(charge.amount.cents)}
    >
      <span class="history-product">
        {escapeHtml(charge.productName) as "safe"}
      </span>
      <span class="history-amount">
        <span class="history-amount-dollars">{dollars as "safe"}.</span>
        <span class="history-amount-cents">
          {cents as "safe"}
          {isNice(charge.amount) && <NiceBadge />}
        </span>
      </span>
      <span class="history-date">{formatDate(charge.date) as "safe"}</span>
    </div>
  );
}

export function AlertsPage({ charges }: { charges: ChargeAlertMessage[] }) {
  const [latest, ...history] = charges;

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
          <title>Donation Alerts | Noisebridge</title>
          <link rel="icon" href="/assets/image/favicon.svg" />
          <link rel="stylesheet" href="/assets/css/reset.css" />
          <link rel="stylesheet" href="/assets/css/alerts.css" />
          <script id="current-charge" type="application/json">
            {JSON.stringify(latest ?? null)}
          </script>
          <script type="module" src="/assets/js/alerts.mjs"></script>
        </head>
        <body>
          <div class="alerts-layout">
            <div class="alerts-spacer"></div>
            <div class="alerts-container">
              <p class="alert-label">Latest Donation</p>
              <p id="alert-amount" class="alert-amount">
                {latest ? formatAmount(latest.amount) : ""}
                {(latest && isNice(latest.amount) && <NiceBadge />) as "safe"}
              </p>
              <p id="alert-product" class="alert-product">
                {latest
                  ? escapeHtml(latest.productName)
                  : "Waiting for donations\u2026"}
              </p>
              <p id="alert-date" class="alert-date">
                {latest ? formatDate(latest.date) : ""}
              </p>
            </div>
            <div class="history-wrapper">
              <div id="history-list" class="history-list">
                {history.map((charge) => (
                  <HistoryItem charge={charge} />
                ))}
              </div>
            </div>
          </div>
          <div class="qr-corner">
            <span class="qr-label">Scan to show fireworks!</span>
            <img
              src={paths.qrSvg(
                { cents: 10000 },
                "Digital Fireworks",
                "Get a high score!",
              )}
              alt="Scan to donate $100"
              class="qr-code"
            />
          </div>
          <canvas id="effect-canvas"></canvas>
          <canvas id="flag-canvas"></canvas>
          <img
            id="snoop-img"
            src="/assets/image/snoop.apng"
            alt=""
            class="snoop-img"
          />
          <img
            id="arnold-img"
            src="/assets/image/arnold.png"
            alt=""
            class="arnold-img"
          />
          <img
            id="eagle-img"
            src="/assets/image/eagle.png"
            alt=""
            class="eagle-img"
          />
          <input type="hidden" id="alerts-ws-path" value={paths.alertsWs()} />
        </body>
      </html>
    </>
  );
}

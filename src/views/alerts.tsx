import { escapeHtml } from "@kitajs/html";
import { importMapJson } from "~/lib/import-map";
import { formatAmount } from "~/lib/money";
import paths from "~/lib/paths";
import type {
  AlertMessage,
  ChargeAlertMessage,
  MemberAlertMessage,
} from "~/types/alerts";
import type { Cents } from "~/types/cents";

/**
 * Serialize a value as JSON for safe embedding inside a `<script>` tag.
 */
function sanitizeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

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

function isNice(amount: Cents): boolean {
  return formatAmount(amount).includes("69");
}

interface ChargeHistoryItemProps {
  alert: ChargeAlertMessage;
}

function ChargeHistoryItem({ alert }: ChargeHistoryItemProps) {
  const [dollars, cents] = amountDisplayText(alert).split(".");

  return (
    <div
      class="history-item"
      data-alert-id={alert.id}
      data-amount={String(alert.amount.cents)}
    >
      <span class="history-product">{escapeHtml(alert.productName)}</span>
      <span class="history-amount">
        <span class="history-amount-dollars">{dollars as "safe"}.</span>
        <span class="history-amount-cents">
          {cents as "safe"}
          {isNice(alert.amount) && <NiceBadge />}
        </span>
      </span>
      <span class="history-date">{formatDate(alert.date) as "safe"}</span>
    </div>
  );
}

interface MemberHistoryItemProps {
  alert: MemberAlertMessage;
}

function MemberHistoryItem({ alert }: MemberHistoryItemProps) {
  return (
    <div class="history-item" data-alert-id={alert.id} data-amount="0">
      <span class="history-product">{escapeHtml(alert.productName)}</span>
      <span class="history-amount">{amountDisplayText(alert) as "safe"}</span>
      <span class="history-date">{formatDate(alert.date) as "safe"}</span>
    </div>
  );
}

interface HistoryItemProps {
  alert: AlertMessage;
}

function HistoryItem({ alert }: HistoryItemProps) {
  switch (alert.type) {
    case "charge_alert":
      return <ChargeHistoryItem alert={alert} />;
    case "member_alert":
      return <MemberHistoryItem alert={alert} />;
  }
}

function amountDisplayText(alert?: AlertMessage) {
  switch (alert?.type) {
    case "charge_alert":
      return formatAmount(alert.amount);
    case "member_alert":
      return "Membership";
    case undefined:
      return "";
  }
}

interface AlertsPageProps {
  alerts: AlertMessage[];
}

export function AlertsPage({ alerts }: AlertsPageProps) {
  const [latest, ...history] = alerts;
  const latestAmountCents =
    latest?.type === "charge_alert" ? latest.amount.cents : 0;

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
          <link rel="icon" href={paths.assetWithHash("image/favicon.svg")} />
          <link rel="stylesheet" href={paths.assetWithHash("css/reset.css")} />
          <link rel="stylesheet" href={paths.assetWithHash("css/alerts.css")} />
          <link
            rel="preload"
            href={paths.asset("font/bitcount/bitcount-latin.woff2")}
            as="font"
            type="font/woff2"
            crossorigin="anonymous"
          />
          <link
            rel="preload"
            href={paths.asset("font/bitcount/bitcount-latin-ext.woff2")}
            as="font"
            type="font/woff2"
            crossorigin="anonymous"
          />
          <script id="current-charge" type="application/json">
            {sanitizeJson(latest ?? null)}
          </script>
          <script type="importmap">{importMapJson}</script>
          <script
            type="module"
            src={paths.assetWithHash("js/util/error-reporting.mjs")}
          ></script>
          <script
            type="module"
            src={paths.assetWithHash("js/alerts.mjs")}
          ></script>
        </head>
        <body>
          <div class="alerts-layout">
            <div class="alerts-spacer"></div>
            <div class="alerts-container">
              <p class="alert-label">Latest Donation</p>
              <p
                id="alert-amount"
                class="alert-amount"
                data-amount={latestAmountCents.toString()}
              >
                {amountDisplayText(latest) as "safe"}
                {latest?.type === "charge_alert" && isNice(latest.amount) && (
                  <NiceBadge />
                )}
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
                {history.map((alert) => (
                  <HistoryItem alert={alert} />
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
          <canvas id="banner-canvas"></canvas>
          <img
            id="snoop-img"
            src={paths.assetWithHash("image/snoop.apng")}
            alt=""
            class="snoop-img"
          />
          <img
            id="arnold-img"
            src={paths.assetWithHash("image/arnold.png")}
            alt=""
            class="arnold-img"
          />
          <img
            id="eagle-img"
            src={paths.assetWithHash("image/eagle.png")}
            alt=""
            class="eagle-img"
          />
          <img
            id="dolphin-fly-0"
            src={paths.assetWithHash("image/dolphin-back.png")}
            alt=""
            class="dolphin-fly"
          />
          <img
            id="dolphin-fly-1"
            src={paths.assetWithHash("image/dolphin-back.png")}
            alt=""
            class="dolphin-fly"
          />
          <img
            id="dolphin-fly-2"
            src={paths.assetWithHash("image/dolphin-back.png")}
            alt=""
            class="dolphin-fly"
          />
          <img
            id="dolphin-fly-3"
            src={paths.assetWithHash("image/dolphin-back.png")}
            alt=""
            class="dolphin-fly"
          />
          <input type="hidden" id="alerts-ws-path" value={paths.alertsWs()} />
        </body>
      </html>
    </>
  );
}

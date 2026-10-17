import { importMapJson } from "~/lib/import-map";
import { formatAmount } from "~/lib/money";
import paths from "~/lib/paths";
import {
  TOP_DONATIONS_END,
  TOP_DONATIONS_HIDE_AT,
  TOP_DONATIONS_START,
} from "~/managers/charge-alert";
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

function AlignedAmount({ alert }: ChargeHistoryItemProps) {
  const [dollars, cents] = amountDisplayText(alert).split(".");

  return (
    <>
      <span class="history-amount-dollars">{dollars}.</span>
      <span class="history-amount-cents">
        {cents}
        {isNice(alert.amount) && <NiceBadge />}
      </span>
    </>
  );
}

function ChargeHistoryItem({ alert }: ChargeHistoryItemProps) {
  return (
    <div
      class="history-item"
      data-alert-id={alert.id}
      data-amount={String(alert.amount.cents)}
    >
      <span class="history-product">{alert.productName}</span>
      <span class="history-amount">
        <AlignedAmount alert={alert} />
      </span>
      <span class="history-date">{formatDate(alert.date)}</span>
    </div>
  );
}

interface MemberHistoryItemProps {
  alert: MemberAlertMessage;
}

function MemberHistoryItem({ alert }: MemberHistoryItemProps) {
  return (
    <div class="history-item" data-alert-id={alert.id} data-amount="0">
      <span class="history-product">{alert.productName}</span>
      <span class="history-amount">{amountDisplayText(alert)}</span>
      <span class="history-date">{formatDate(alert.date)}</span>
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

const PLACES = ["st", "nd", "rd"];

interface TopDonationsProps {
  donations: ChargeAlertMessage[];
}

function TopDonations({ donations }: TopDonationsProps) {
  return (
    <div
      id="top-donations"
      class="top-donations"
      data-start={TOP_DONATIONS_START.toISOString()}
      data-end={TOP_DONATIONS_END.toISOString()}
      data-hide-at={TOP_DONATIONS_HIDE_AT.toISOString()}
    >
      <p class="alert-label top-donations-label">NB18 Top Donations</p>
      {PLACES.map((suffix, index) => {
        const donation = donations[index];
        return (
          <div
            class={`top-donation place-${index + 1}`}
            data-alert-id={donation?.id ?? ""}
            data-cents={String(donation?.amount.cents ?? 0)}
          >
            <span class="place">
              {index + 1}
              <span class="place-suffix">{suffix}</span>
            </span>
            <span class="top-donation-amount">
              {donation
                ? formatAmount(donation.amount).replace(/\.00$/, "")
                : "\u2014"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

interface AlertsPageProps {
  alerts: AlertMessage[];
  /** Null once the podium should be hidden. */
  topDonations: ChargeAlertMessage[] | null;
}

export function AlertsPage({ alerts, topDonations }: AlertsPageProps) {
  const [latest, ...history] = alerts;
  const latestAmountCents =
    latest?.type === "charge_alert" ? latest.amount.cents : 0;

  return (
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
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
        <script
          id="current-charge"
          type="application/json"
          dangerouslySetInnerHTML={{ __html: sanitizeJson(latest ?? null) }}
        />
        <script
          type="importmap"
          dangerouslySetInnerHTML={{ __html: importMapJson }}
        />
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
            <p class="alert-label">Latest Donations</p>
            <div class="history-item alert-latest">
              <span id="alert-product" class="history-product">
                {latest ? latest.productName : "Waiting for donations\u2026"}
              </span>
              <span
                id="alert-amount"
                class="history-amount"
                data-amount={latestAmountCents.toString()}
              >
                {latest?.type === "charge_alert" ? (
                  <AlignedAmount alert={latest} />
                ) : (
                  amountDisplayText(latest)
                )}
              </span>
              <span id="alert-date" class="history-date">
                {latest ? formatDate(latest.date) : ""}
              </span>
            </div>
          </div>
          <div class="history-wrapper">
            <div id="history-list" class="history-list">
              {history.map((alert) => (
                <HistoryItem alert={alert} />
              ))}
            </div>
          </div>
        </div>
        <div class="bottom-dock">
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
          {topDonations && <TopDonations donations={topDonations} />}
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
      </body>
    </html>
  );
}

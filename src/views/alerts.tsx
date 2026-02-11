import paths from "~/paths";

export function AlertsPage() {
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
          <script type="module" src="/assets/js/alerts.mjs"></script>
        </head>
        <body>
          <div class="alerts-layout">
            <div class="alerts-spacer"></div>
            <div class="alerts-container">
              <p class="alert-label">Latest Donation</p>
              <p id="alert-amount" class="alert-amount"></p>
              <p id="alert-product" class="alert-product">
                Waiting for donations&hellip;
              </p>
              <p id="alert-date" class="alert-date"></p>
            </div>
            <div class="history-wrapper">
              <div id="history-list" class="history-list"></div>
            </div>
          </div>
          <canvas id="confetti-canvas"></canvas>
          <input type="hidden" id="alerts-ws-path" value={paths.alertsWs()} />
        </body>
      </html>
    </>
  );
}

import { Layout } from "~/components/layout";
import { DonationManager } from "~/managers/donation";
import { formatAmount } from "~/money";
import paths from "~/paths";

export interface QrEditorProps {
  isAuthenticated: boolean;
  baseUrl: string;
}

export function QrEditorPage({ isAuthenticated, baseUrl }: QrEditorProps) {
  return (
    <Layout
      title="QR Code Creator"
      script="qr-editor.mjs"
      styles="qr-editor.css"
      isAuthenticated={isAuthenticated}
    >
      <div class="container">
        <section class="hero">
          <h1>Donation QR Code Creator</h1>
          <p>Generate donation QR codes for use in the hackerspace</p>
        </section>

        <div class="card">
          <h2>Parameters</h2>

          <form id="qr-form" action={paths.qrSvg()} method="GET">
            <div class="form-group">
              <label for="amount">Amount (USD)</label>
              <div class="input-group">
                <span class="input-prefix" aria-hidden="true">
                  $
                </span>
                <input
                  type="text"
                  inputmode="numeric"
                  id="amount"
                  name="amount"
                  placeholder="0.00"
                  data-min={DonationManager.minimumAmount.cents / 100}
                  required
                />
              </div>
              <span class="form-hint">
                Minimum {formatAmount(DonationManager.minimumAmount)}
              </span>
            </div>

            <div class="form-group">
              <label for="name">Product Name (optional)</label>
              <input
                type="text"
                id="name"
                name="name"
                placeholder={DonationManager.defaultName}
                maxlength={40}
              />
            </div>

            <div class="form-group">
              <label for="description">Description (optional)</label>
              <input
                type="text"
                id="description"
                name="description"
                placeholder={DonationManager.defaultDescription}
                maxlength={80}
              />
            </div>

            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" id="use-logo" name="use-logo" checked />
                Include Logo
              </label>
            </div>
          </form>
        </div>

        <div class="card qr-preview-card">
          <h2>Preview</h2>
          <div class="qr-preview">
            <img
              id="qr-image"
              src=""
              alt="QR Code preview"
              style="display: none;"
            />
            <div id="qr-placeholder" class="qr-placeholder">
              Enter an amount to generate a QR code
            </div>
          </div>
          <div class="qr-url-display">
            <input
              type="text"
              id="qr-url"
              name="qr-url"
              value={`${baseUrl}${paths.qr()}`}
              readonly
            />
          </div>
          <div class="button-group">
            <button type="button" id="download-png" class="btn btn-primary">
              Download PNG
            </button>
            <button type="button" id="download-svg" class="btn btn-secondary">
              Download SVG
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}

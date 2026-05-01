import { Button } from "~/components/button";
import { Layout } from "~/components/layout";
import { PageHead } from "~/components/page-head";
import { SectionHead } from "~/components/section-head";
import config from "~/config";
import { DonationManager } from "~/managers/donation";
import { formatAmount } from "~/money";
import paths from "~/paths";

function DownloadSVG() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      stroke-width="1.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <title>Download</title>
      <path d="M8 2v8m0 0l-3-3m3 3l3-3M2 12v1a1 1 0 001 1h10a1 1 0 001-1v-1" />
    </svg>
  );
}

export interface QrEditorProps {
  isAuthenticated: boolean;
}

export function QrEditorPage({ isAuthenticated }: QrEditorProps) {
  return (
    <Layout
      title="QR Code Creator"
      script="qr-editor.mjs"
      styles="qr-editor.css"
      isAuthenticated={isAuthenticated}
    >
      <div class="container-wide">
        <PageHead title="qr_editor" />

        <p class="page-desc">
          Generate a scannable QR code that opens a pre-filled Noisebridge
          donation. Perfect for laser-cut signs, 3D-printed placards, flyers at
          the space, or slapping on the side of a vending machine.
        </p>

        <div class="editor-grid">
          <section>
            <SectionHead title="parameters" meta={"Live preview \u2192"} />

            <form id="qr-form" action={paths.qrSvg()} method="GET">
              <div class="field">
                <label class="field-label" for="amount">
                  <span class="field-idx">[01]</span>
                  Donation amount
                </label>
                <div class="input-wrap input-wrap-amount">
                  <span class="input-prefix-box" aria-hidden="true">
                    $
                  </span>
                  <input
                    type="text"
                    inputmode="decimal"
                    id="amount"
                    name="amount"
                    placeholder="0.00"
                    data-min={DonationManager.minimumAmount.cents / 100}
                    required
                  />
                </div>
                <span class="field-hint">
                  Minimum{" "}
                  {formatAmount(DonationManager.minimumAmount) as "safe"}.
                  Donors can still adjust this when they scan — it's just a
                  suggested default.
                </span>
              </div>

              <div class="field">
                <label class="field-label" for="name">
                  <span class="field-idx">[02]</span>
                  Product name
                  <span class="field-opt">— optional</span>
                </label>
                <div class="input-wrap">
                  <input
                    type="text"
                    id="name"
                    name="name"
                    placeholder={DonationManager.defaultName}
                    maxlength={DonationManager.maxNameLength}
                  />
                </div>
                <span class="field-hint">
                  Appears on the donor's receipt and checkout page.
                </span>
              </div>

              <div class="field">
                <label class="field-label" for="description">
                  <span class="field-idx">[03]</span>
                  Description
                  <span class="field-opt">— optional</span>
                </label>
                <div class="input-wrap">
                  <input
                    type="text"
                    id="description"
                    name="description"
                    placeholder={DonationManager.defaultDescription}
                    maxlength={DonationManager.maxDescriptionLength}
                  />
                </div>
                <span class="field-hint">
                  Shown under the product name at checkout.
                </span>
              </div>

              <label class="check-row" for="use-logo">
                <input type="checkbox" id="use-logo" name="use-logo" checked />
                <div>
                  <span class="check-lbl">Include Noisebridge logo</span>
                  <span class="check-desc">
                    Embed our logo in the center of the QR code.
                  </span>
                </div>
              </label>
            </form>
          </section>

          <section>
            <SectionHead title="preview" />

            <div class="preview-card">
              <div class="qr-frame">
                <img id="qr-image" src="" alt="QR Code preview" hidden />
                <div id="qr-placeholder" class="qr-placeholder">
                  <div class="qr-placeholder-icon">[ ]</div>
                  <div class="qr-placeholder-msg">Enter an amount</div>
                  <div class="qr-placeholder-sub">QR updates as you type</div>
                </div>
              </div>

              <div class="qr-url-wrap">
                <div class="field-label">
                  <span class="field-idx">{"\u2192"}</span>
                  Target URL
                </div>
                <div class="qr-url-display">
                  <input
                    type="text"
                    id="qr-url"
                    name="qr-url"
                    value={`${config.baseUrl}${paths.qr()}`}
                    readonly
                  />
                </div>
              </div>

              <div class="button-group">
                <Button
                  variant="ghost"
                  id="download-png"
                  icon={<DownloadSVG />}
                >
                  Download PNG
                </Button>
                <Button
                  variant="ghost"
                  id="download-svg"
                  icon={<DownloadSVG />}
                >
                  Download SVG
                </Button>
              </div>
            </div>

            <a
              class="wiki-callout"
              href="https://www.noisebridge.net/wiki/Donation_QR_Codes#3D"
              target="_blank"
              rel="noopener noreferrer"
            >
              <div class="wiki-body">
                <div class="wiki-title">3D-printable QR codes on the wiki</div>
                <div class="wiki-desc">
                  Includes instructions for generating 3D-print files, as well
                  as links to a collection of pre-made QR code files.
                </div>
              </div>
            </a>
          </section>
        </div>
      </div>
    </Layout>
  );
}

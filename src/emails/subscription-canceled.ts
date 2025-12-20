import { Layout } from "./layout";

export interface SubscriptionCanceledEmailProps {
  amountCents: number;
}

/**
 * Format cents as dollar amount
 */
function formatAmount(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Generate HTML email for subscription cancellation
 */
export function SubscriptionCanceledEmail({
  amountCents,
}: SubscriptionCanceledEmailProps): string {
  return Layout(`
    <mj-text font-size="24px" font-weight="700" color="#333333" align="center" padding-bottom="20px">
      Your Donation Has Been Canceled
    </mj-text>
    <mj-text align="center" padding-bottom="20px">
      Your monthly donation to Noisebridge has been successfully canceled.
    </mj-text>
    <mj-table padding="20px" css-class="amount-box">
      <tr>
        <td style="background-color: #f8f8f8; padding: 20px; border-radius: 8px; text-align: center;">
          <div style="font-size: 16px; margin-bottom: 10px; color: #555555;">
            Canceled Monthly Amount
          </div>
          <div style="font-size: 36px; font-weight: 700; color: #888888;">
            ${formatAmount(amountCents)}
          </div>
        </td>
      </tr>
    </mj-table>
    <mj-text align="center" padding-top="30px">
      We're sorry to see you go! Your recurring donation has been canceled and you will not be charged again.
    </mj-text>
    <mj-text align="center" padding-top="20px">
      We hope you'll consider supporting Noisebridge again in the future. You can set up a new donation anytime at donate.noisebridge.net
    </mj-text>
    <mj-divider border-color="#e0e0e0" padding="30px 0 20px 0" />
    <mj-text align="center" color="#888888" font-size="12px">
      Thank you for your past support of Noisebridge!
    </mj-text>
  `);
}

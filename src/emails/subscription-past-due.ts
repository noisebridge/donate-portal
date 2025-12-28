import { type Cents, formatAmount } from "~/money";
import { Layout } from "./layout";

export interface SubscriptionPastDueEmailProps {
  amount?: Cents | undefined;
}

/**
 * Generate HTML email for subscription payment past due
 */
export function SubscriptionPastDueEmail({
  amount,
}: SubscriptionPastDueEmailProps): string {
  return Layout(`
    <mj-text font-size="24px" font-weight="700" color="#333333" align="center" padding-bottom="20px">
      Payment Issue with Your Donation
    </mj-text>
    <mj-text align="center" padding-bottom="20px">
      We were unable to process your monthly donation to Noisebridge.
    </mj-text>
    ${
      amount
        ? `<mj-table padding="20px" css-class="amount-box">
      <tr>
        <td style="background-color: #f8f8f8; padding: 20px; border-radius: 8px; text-align: center;">
          <div style="font-size: 16px; margin-bottom: 10px; color: #555555;">
            Monthly Donation Amount
          </div>
          <div style="font-size: 36px; font-weight: 700; color: #888888;">
            ${formatAmount(amount)}
          </div>
        </td>
      </tr>
    </mj-table>`
        : ""
    }
    <mj-text align="center" padding-top="30px">
      Please update your payment method to continue supporting Noisebridge.
    </mj-text>
    <mj-button href="https://donate.noisebridge.net/auth" padding-top="20px">
      Sign In
    </mj-button>
    <mj-text align="center" padding-top="20px" color="#888888" font-size="12px">
      Once signed in, click the "Payment Methods" button.
    </mj-text>
    <mj-divider border-color="#e0e0e0" padding="30px 0 20px 0" />
    <mj-text align="center" color="#888888" font-size="12px">
      Thank you for your continued support of Noisebridge!
    </mj-text>
  `);
}

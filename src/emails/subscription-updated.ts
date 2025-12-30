import config from "~/config";
import { type Cents, formatAmount } from "~/money";
import paths from "~/paths";
import { Layout } from "./layout";

export interface SubscriptionUpdatedEmailProps {
  oldAmount: Cents;
  newAmount: Cents;
}

/**
 * Generate HTML email for subscription amount change
 */
export function SubscriptionUpdatedEmail({
  oldAmount,
  newAmount,
}: SubscriptionUpdatedEmailProps): string {
  return Layout(
    "Your Donation Has Been Updated",
    `
    <mj-text font-size="24px" font-weight="700" color="#333333" align="center" padding-bottom="20px">
      Your Donation Has Been Updated
    </mj-text>
    <mj-text align="center" padding-bottom="20px">
      Your monthly donation amount to Noisebridge has been changed.
    </mj-text>
    <mj-table padding="20px" css-class="amount-box">
      <tr>
        <td style="background-color: #f8f8f8; padding: 20px; border-radius: 8px; text-align: center;">
          <div style="font-size: 16px; margin-bottom: 10px; color: #555555;">
            Previous Amount
          </div>
          <div style="font-size: 24px; font-weight: 700; color: #888888; text-decoration: line-through;">
            ${formatAmount(oldAmount)}
          </div>
        </td>
      </tr>
    </mj-table>
    <mj-table padding="20px" css-class="amount-box">
      <tr>
        <td style="background-color: #f8f8f8; padding: 20px; border-radius: 8px; text-align: center;">
          <div style="font-size: 16px; margin-bottom: 10px; color: #555555;">
            New Monthly Amount
          </div>
          <div style="font-size: 36px; font-weight: 700; color: #cc3333;">
            ${formatAmount(newAmount)}
          </div>
        </td>
      </tr>
    </mj-table>
    <mj-text align="center" padding-top="30px">
      Your new donation amount will take effect on your next billing cycle.
    </mj-text>
    <mj-text align="center" padding-top="20px">
      Sign in to manage your donation
      <a href="${config.baseUrl}${paths.signIn()}">${config.baseUrl}${paths.signIn()}</a>
    </mj-text>
    <mj-divider border-color="#e0e0e0" padding="30px 0 20px 0" />
    <mj-text align="center" color="#888888" font-size="12px">
      Thank you for your continued support of Noisebridge!
    </mj-text>
  `,
  );
}

import config from "~/config";
import { type Cents, formatAmount } from "~/money";
import paths from "~/paths";
import { Layout } from "./layout";

export interface SubscriptionWelcomeEmailProps {
  amount: Cents;
}

/**
 * Generate HTML email for new subscription welcome
 */
export function SubscriptionWelcomeEmail({
  amount,
}: SubscriptionWelcomeEmailProps): string {
  return Layout(
    "Thank You for Your Support!",
    `
    <mj-text font-size="24px" font-weight="700" color="#333333" align="center" padding-bottom="20px">
      Thank You for Your Support!
    </mj-text>
    <mj-text align="center" padding-bottom="20px">
      Your monthly donation to Noisebridge has been set up successfully.
    </mj-text>
    <mj-table padding="20px" css-class="amount-box">
      <tr>
        <td style="background-color: #f8f8f8; padding: 20px; border-radius: 8px; text-align: center;">
          <div style="font-size: 16px; margin-bottom: 10px; color: #555555;">
            Monthly Donation Amount
          </div>
          <div style="font-size: 36px; font-weight: 700; color: #cc3333;">
            ${formatAmount(amount)}
          </div>
        </td>
      </tr>
    </mj-table>
    <mj-text align="center" padding-top="30px">
      Your support helps keep Noisebridge running and accessible to everyone.
      You'll be charged this amount each month.
    </mj-text>
    <mj-text align="center" padding-top="20px">
      Sign in to manage your donation
      <a href="${config.baseUrl}${paths.signIn()}">${config.baseUrl}${paths.signIn()}</a>
    </mj-text>
    <mj-divider border-color="#e0e0e0" padding="30px 0 20px 0" />
    <mj-text align="center" color="#888888" font-size="12px">
      Thank you for supporting Noisebridge!
    </mj-text>
  `,
  );
}

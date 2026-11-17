import { formatAmount } from "~/lib/money";
import type { Cents } from "~/types/cents";
import { fontStack, Row } from "./row";

/**
 * How the amount is presented: the highlighted current amount, a muted one
 * after cancellation, or a struck-out previous amount.
 */
export type AmountVariant = "accent" | "muted" | "crossed";

export interface AmountSummaryProps {
  /** What the amount is for, e.g. "Monthly Donation Amount". */
  label: string;
  amount: Cents;
  variant: AmountVariant;
}

const amountStyles: Record<AmountVariant, string> = {
  accent: "font-size: 36px; font-weight: 700; color: #cc3333;",
  muted: "font-size: 36px; font-weight: 700; color: #888888;",
  crossed:
    "font-size: 24px; font-weight: 700; color: #888888; text-decoration: line-through;",
};

/** A callout box showing a donation amount. */
export function AmountSummary({ label, amount, variant }: AmountSummaryProps) {
  return (
    <Row align="left" padding="20px" class="amount-box">
      <table
        cellpadding="0"
        cellspacing="0"
        width="100%"
        border={0}
        style={`color:#000000;font-family:${fontStack};font-size:13px;line-height:22px;table-layout:auto;width:100%;border:none;`}
      >
        <tr>
          <td style="background-color: #f8f8f8; padding: 20px; border-radius: 8px; text-align: center;">
            <div style="font-size: 16px; margin-bottom: 10px; color: #555555;">
              {label}
            </div>
            <div style={amountStyles[variant]}>{formatAmount(amount)}</div>
          </td>
        </tr>
      </table>
    </Row>
  );
}

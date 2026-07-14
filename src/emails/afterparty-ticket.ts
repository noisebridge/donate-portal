import { formatAmount } from "~/lib/money";
import type { Cents } from "~/types/cents";
import { Layout } from "./layout";

export interface AfterpartyTicketEmailProps {
  quantity: number;
  amount: Cents;
}

/**
 * Generate the HTML ticket email for a confirmed afterparty purchase. Leads
 * with the attendee count so the buyer can show it at the door.
 */
export async function AfterpartyTicketEmail({
  quantity,
  amount,
}: AfterpartyTicketEmailProps): Promise<string> {
  const ticketWord = quantity === 1 ? "ticket" : "tickets";

  return await Layout(
    "You're on the list!",
    `
    <mj-text font-size="12px" font-weight="700" color="#cc3333" align="center" letter-spacing="2px" text-transform="uppercase" padding-bottom="6px">
      Noisebridge · OpenSauce Afterparty
    </mj-text>
    <mj-text font-size="26px" font-weight="700" color="#333333" align="center" padding-bottom="20px">
      You're on the list!
    </mj-text>
    <mj-text align="center" padding-bottom="24px">
      Thanks for grabbing ${quantity} ${ticketWord}. This email covers all
      ${quantity} ${quantity === 1 ? "attendee" : "attendees"} and is your ticket.
      Show it at the door.
    </mj-text>
    <mj-table padding="0 20px 20px 20px">
      <tr>
        <td style="background-color: #17130e; padding: 28px 20px; border-radius: 8px; text-align: center;">
          <div style="font-size: 13px; letter-spacing: 2px; text-transform: uppercase; color: #aea391; margin-bottom: 10px;">
            Attendees
          </div>
          <div style="font-size: 56px; font-weight: 700; color: #ffffff; line-height: 1;">
            ${quantity}
          </div>
        </td>
      </tr>
    </mj-table>
    <mj-table padding="0 20px">
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eeeeee; color: #888888; font-size: 13px;">When</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eeeeee; text-align: right; color: #333333; font-size: 14px; font-weight: 600;">Sun Jul 19 · 9PM–1AM</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; border-bottom: 1px solid #eeeeee; color: #888888; font-size: 13px;">Where</td>
        <td style="padding: 10px 0; border-bottom: 1px solid #eeeeee; text-align: right; color: #333333; font-size: 14px; font-weight: 600;">Noisebridge · 272 Capp St, SF</td>
      </tr>
      <tr>
        <td style="padding: 10px 0; color: #888888; font-size: 13px;">Total paid</td>
        <td style="padding: 10px 0; text-align: right; color: #333333; font-size: 14px; font-weight: 600;">${formatAmount(amount)}</td>
      </tr>
    </mj-table>
    <mj-text align="center" padding-top="30px">
      See you on the dance floor. Live sets, blinkenlights, and Club-Maté on ice.
    </mj-text>
    <mj-divider border-color="#e0e0e0" padding="30px 0 20px 0" />
    <mj-text align="center" color="#888888" font-size="12px">
      Every dollar over cost keeps Noisebridge open 24/7. Thank you!
    </mj-text>
  `,
  );
}

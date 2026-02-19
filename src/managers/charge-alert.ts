import crypto from "node:crypto";
import type { WebSocket } from "@fastify/websocket";
import type Stripe from "stripe";
import { baseLogger } from "~/logger";
import type { Cents } from "~/money";
import stripe from "~/services/stripe";

export interface ChargeAlert {
  id: string;
  date: string;
  amount: Cents;
  productName: string;
}

const MAX_RECENT_CHARGES = 30;

const generalDonationName = "General Donation";
const nameRemap: Record<string, string> = {
  "Donation to Noisebridge": generalDonationName,
  "Support Us": generalDonationName,
};

export class ChargeAlertManager {
  static readonly log = baseLogger.child({ class: "ChargeAlertManager" });

  private connections = new Set<WebSocket>();

  private static hashSessionId(sessionId: string): string {
    return crypto.createHash("sha256").update(sessionId).digest("hex");
  }

  addConnection(socket: WebSocket) {
    this.connections.add(socket);

    socket.on("close", () => {
      this.connections.delete(socket);
    });
  }

  async processWebhook(event: Stripe.Event) {
    if (event.type !== "checkout.session.completed") {
      return;
    }

    const session = event.data.object;
    if (session.mode !== "payment") {
      return;
    }

    this.broadcast(await this.formatChargeAlert(session));
  }

  /**
   * Fetch the most recent completed one-time payment sessions from Stripe.
   */
  async fetchRecentCharges(): Promise<ChargeAlert[]> {
    const sessions = await stripe.checkout.sessions.list({
      status: "complete",
      limit: 100,
      expand: ["data.line_items"],
    });

    const paymentSessions = sessions.data
      .filter((session) => session.mode === "payment")
      .slice(0, MAX_RECENT_CHARGES);

    const alerts = await Promise.all(
      paymentSessions.map(
        async (session) => await this.formatChargeAlert(session),
      ),
    );

    return alerts;
  }

  private async formatChargeAlert(
    session: Stripe.Checkout.Session,
  ): Promise<ChargeAlert> {
    const lineItems =
      session.line_items ??
      (await stripe.checkout.sessions.listLineItems(session.id));

    return {
      id: ChargeAlertManager.hashSessionId(session.id),
      date: new Date(session.created * 1000).toISOString(),
      amount: { cents: session.amount_total ?? 0 },
      productName: this.getProductName(lineItems),
    };
  }

  private broadcast(alert: ChargeAlert) {
    const message = JSON.stringify(alert);
    for (const socket of this.connections) {
      socket.send(message);
    }
  }

  private getProductName(lineItems: Stripe.ApiList<Stripe.LineItem>) {
    const productName = lineItems.data[0]?.description;
    if (!productName) {
      return generalDonationName;
    }

    const remappedName = nameRemap[productName];
    if (!remappedName) {
      return productName;
    }

    return remappedName;
  }
}

const chargeAlertManager = new ChargeAlertManager();
export default chargeAlertManager;

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

const generalDonationName = "General Donation";
const nameRemap: Record<string, string> = {
  "Donation to Noisebridge": generalDonationName,
  "Support Us": generalDonationName,
};

export class ChargeAlertManager {
  static readonly log = baseLogger.child({ class: "ChargeAlertManager" });

  private connections = new Set<WebSocket>();
  private lastPayment: ChargeAlert | null = null;

  private static hashSessionId(sessionId: string): string {
    return crypto.createHash("sha256").update(sessionId).digest("hex");
  }

  async addConnection(socket: WebSocket) {
    this.connections.add(socket);

    if (!this.lastPayment) {
      this.lastPayment = await this.fetchLastPayment();
    }

    if (this.lastPayment) {
      this.broadcast(this.lastPayment);
    }

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

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    const alert: ChargeAlert = {
      id: ChargeAlertManager.hashSessionId(session.id),
      date: new Date(session.created * 1000).toISOString(),
      amount: { cents: session.amount_total ?? 0 },
      productName: this.getProductName(lineItems),
    };

    this.lastPayment = alert;
    this.broadcast(alert);
  }

  private broadcast(alert: ChargeAlert) {
    const message = JSON.stringify(alert);
    for (const socket of this.connections) {
      socket.send(message);
    }
  }

  private async fetchLastPayment(): Promise<ChargeAlert | null> {
    const sessions = await stripe.checkout.sessions.list({
      status: "complete",
      limit: 10,
    });

    const session = sessions.data.find((session) => session.mode === "payment");
    if (!session) {
      return null;
    }

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    return {
      id: ChargeAlertManager.hashSessionId(session.id),
      date: new Date(session.created * 1000).toISOString(),
      amount: { cents: session.amount_total ?? 0 },
      productName: this.getProductName(lineItems),
    };
  }

  private getProductName(
    lineItems: Stripe.Response<Stripe.ApiList<Stripe.LineItem>>,
  ) {
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

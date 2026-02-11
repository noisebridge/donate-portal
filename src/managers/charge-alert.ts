import type { WebSocket } from "@fastify/websocket";
import type Stripe from "stripe";
import { baseLogger } from "~/logger";
import type { Cents } from "~/money";
import stripe from "~/services/stripe";

export interface ChargeAlert {
  date: string;
  amount: Cents;
  productName: string;
};

export class ChargeAlertManager {
  static readonly log = baseLogger.child({ class: "ChargeAlertManager" });

  private connections = new Set<WebSocket>();
  private lastPayment: ChargeAlert | null = null;

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

    const session = event.data.object as Stripe.Checkout.Session;
    if (session.mode !== "payment") {
      return;
    }

    const lineItems = await stripe.checkout.sessions.listLineItems(session.id);
    const productName = lineItems.data[0]?.description ?? "One-time donation";

    const alert: ChargeAlert = {
      date: new Date(session.created * 1000).toISOString(),
      amount: { cents: session.amount_total ?? 0 },
      productName,
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
    const productName = lineItems.data[0]?.description ?? "One-time donation";

    return {
      date: new Date(session.created * 1000).toISOString(),
      amount: { cents: session.amount_total ?? 0 },
      productName,
    };
  }
}

const chargeAlertManager = new ChargeAlertManager();
export default chargeAlertManager;

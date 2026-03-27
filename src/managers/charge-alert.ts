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

const MAX_RECENT_CHARGES = 20;
export const GENERAL_DONATION = "General Donation";
export const NAME_REMAP: Record<string, string> = {
  "Donation to Noisebridge": GENERAL_DONATION,
  "Support Us": GENERAL_DONATION,
};

const PING_INTERVAL_MS = 30_000;

export class ChargeAlertManager {
  static readonly log = baseLogger.child({ class: "ChargeAlertManager" });

  private connections = new Map<WebSocket, { alive: boolean }>();
  private pingInterval: NodeJS.Timeout | null = null;

  addConnection(socket: WebSocket) {
    const state = { alive: true };
    this.connections.set(socket, state);

    socket.on("pong", () => {
      state.alive = true;
    });

    socket.on("close", () => {
      this.connections.delete(socket);
    });

    if (!this.pingInterval) {
      this.startPinging();
    }
  }

  private startPinging() {
    this.pingInterval = setInterval(() => {
      for (const [socket, state] of this.connections) {
        if (!state.alive) {
          socket.terminate();
          this.connections.delete(socket);
          continue;
        }

        state.alive = false;
        socket.ping();
      }

      if (this.connections.size === 0 && this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
    }, PING_INTERVAL_MS);
    // Allows the process to terminate even when the interval is running.
    this.pingInterval.unref();
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
      limit: 3 * MAX_RECENT_CHARGES,
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
      id: this.hashSessionId(session.id),
      date: new Date(session.created * 1000).toISOString(),
      amount: { cents: session.amount_total ?? 0 },
      productName: this.getProductName(lineItems),
    };
  }

  private broadcast(alert: ChargeAlert) {
    const message = JSON.stringify(alert);
    for (const socket of this.connections.keys()) {
      socket.send(message);
    }
  }

  private hashSessionId(sessionId: string): string {
    return crypto
      .createHash("sha256")
      .update(sessionId)
      .digest("hex")
      .slice(0, 12);
  }

  private getProductName(lineItems: Stripe.ApiList<Stripe.LineItem>) {
    const productName = lineItems.data[0]?.description;
    if (!productName) {
      return GENERAL_DONATION;
    }

    return NAME_REMAP[productName] ?? productName;
  }
}

const chargeAlertManager = new ChargeAlertManager();
export default chargeAlertManager;

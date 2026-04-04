import crypto from "node:crypto";
import type { WebSocket } from "@fastify/websocket";
import type Stripe from "stripe";
import { baseLogger } from "~/logger";
import type { Cents } from "~/money";
import stripe from "~/services/stripe";

export interface ChargeAlertMessage {
  type: "charge_alert";
  id: string;
  date: string;
  amount: Cents;
  productName: string;
}

export interface PingMessage {
  type: "ping";
}

export interface PongMessage {
  type: "pong";
}

export type WebsocketMessage = ChargeAlertMessage | PingMessage;

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
    this.connections.set(socket, { alive: true });

    socket.on("message", (data) => {
      try {
        const message = JSON.parse(String(data)) as { type: string };
        if (message.type === "pong") {
          const state = this.connections.get(socket);
          if (state) {
            state.alive = true;
          }
        }
      } catch (err) {
        ChargeAlertManager.log.error({ err }, "Failed to parse client message");
      }
    });

    socket.on("close", () => {
      this.connections.delete(socket);
    });

    if (!this.pingInterval) {
      this.startPinging();
    }
  }

  private sendPing(socket: WebSocket) {
    try {
      const message: PingMessage = { type: "ping" };
      socket.send(JSON.stringify(message));
    } catch (err) {
      ChargeAlertManager.log.error({ err }, "Failed to send ping");
      this.connections.delete(socket);
      socket.terminate();
    }
  }

  private startPinging() {
    this.pingInterval = setInterval(() => {
      for (const [socket, state] of this.connections) {
        if (!state.alive) {
          ChargeAlertManager.log.warn("Terminating unresponsive connection");
          this.connections.delete(socket);
          socket.terminate();
          continue;
        }

        state.alive = false;
        this.sendPing(socket);
      }

      if (this.connections.size === 0 && this.pingInterval) {
        clearInterval(this.pingInterval);
        this.pingInterval = null;
      }
    }, PING_INTERVAL_MS);
    // Allows the process to terminate even when the interval is running.
    this.pingInterval.unref();
  }

  async processWebhook(event: Stripe.PaymentIntentSucceededEvent) {
    const paymentIntent = event.data.object;
    if (!this.isDonation(paymentIntent)) {
      return;
    }

    this.broadcast(this.formatChargeAlert(paymentIntent));
  }

  /**
   * Fetch the most recent completed one-time payments from Stripe.
   */
  async fetchRecentCharges(): Promise<ChargeAlertMessage[]> {
    const paymentIntents = await stripe.paymentIntents.list({
      limit: 3 * MAX_RECENT_CHARGES,
    });

    return paymentIntents.data
      .filter((paymentIntent) => paymentIntent.status === "succeeded")
      .filter((paymentIntent) => this.isDonation(paymentIntent))
      .slice(0, MAX_RECENT_CHARGES)
      .map((paymentIntent) => this.formatChargeAlert(paymentIntent));
  }

  /**
   * Whether a payment intent is for a one-off donation.
   */
  private isDonation(paymentIntent: Stripe.PaymentIntent): boolean {
    return paymentIntent.customer === null;
  }

  private formatChargeAlert(
    paymentIntent: Stripe.PaymentIntent,
  ): ChargeAlertMessage {
    return {
      type: "charge_alert",
      id: this.createAlertId(paymentIntent),
      date: new Date(paymentIntent.created * 1000).toISOString(),
      amount: { cents: paymentIntent.amount ?? 0 },
      productName: this.getProductName(paymentIntent),
    };
  }

  private broadcast(alert: ChargeAlertMessage) {
    const message = JSON.stringify(alert);
    for (const socket of this.connections.keys()) {
      try {
        socket.send(message);
      } catch (err) {
        ChargeAlertManager.log.error({ err }, "Failed to broadcast alert");
        this.connections.delete(socket);
        socket.terminate();
      }
    }
  }

  private createAlertId(paymentIntent: Stripe.PaymentIntent): string {
    return crypto
      .createHash("sha256")
      .update(paymentIntent.id)
      .digest("hex")
      .slice(0, 12);
  }

  private getProductName(paymentIntent: Stripe.PaymentIntent): string {
    const name = paymentIntent.metadata?.["name"] ?? paymentIntent.description;
    if (!name) {
      return GENERAL_DONATION;
    }

    return NAME_REMAP[name] ?? name;
  }
}

const chargeAlertManager = new ChargeAlertManager();
export default chargeAlertManager;

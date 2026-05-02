import crypto from "node:crypto";
import type { WebSocket } from "@fastify/websocket";
import {
  englishDataset,
  englishRecommendedTransformers,
  RegExpMatcher,
  TextCensor,
} from "obscenity";
import type Stripe from "stripe";
import { baseLogger } from "~/logger";
import stripe from "~/services/stripe";
import type {
  AlertMessage,
  ChargeAlertMessage,
  MemberAlertMessage,
  PingMessage,
} from "~/types/alerts";
import { GENERAL_DONATION, NAME_REMAP } from "./donation";
import { SubscriptionManager } from "./subscription";

const MAX_RECENT_ALERTS = 20;
const PING_INTERVAL_MS = 30_000;

const obscenityMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});
const obscenityCensor = new TextCensor();

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

  handlePaymentSuccess(event: Stripe.PaymentIntentSucceededEvent) {
    const paymentIntent = event.data.object;
    if (!this.isDonation(paymentIntent)) {
      return;
    }

    this.broadcastAlert(this.formatChargeAlert(paymentIntent));
  }

  handleNewSubscription(event: Stripe.CustomerSubscriptionCreatedEvent) {
    const subscription = event.data.object;
    if (!this.isMembership(subscription)) {
      return;
    }

    this.broadcastAlert(this.formatMemberAlert(event.data.object));
  }

  /**
   * Fetch recent one-time payments and new subscriptions from Stripe,
   * interleaved by date descending.
   */
  async fetchRecentAlerts(): Promise<AlertMessage[]> {
    const [paymentIntents, subscriptions] = await Promise.all([
      stripe.paymentIntents.list({ limit: 3 * MAX_RECENT_ALERTS }),
      stripe.subscriptions.list({
        limit: MAX_RECENT_ALERTS,
        status: "active",
      }),
    ]);

    const charges: AlertMessage[] = paymentIntents.data
      .filter((paymentIntent) => paymentIntent.status === "succeeded")
      .filter((paymentIntent) => this.isDonation(paymentIntent))
      .map((paymentIntent) => this.formatChargeAlert(paymentIntent));

    const memberships: AlertMessage[] = subscriptions.data
      .filter((subscription) => this.isMembership(subscription))
      .map((subscription) => this.formatMemberAlert(subscription));

    return [...charges, ...memberships]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, MAX_RECENT_ALERTS);
  }

  /**
   * Whether a payment intent is for a one-off donation.
   */
  private isDonation(paymentIntent: Stripe.PaymentIntent): boolean {
    return paymentIntent.customer === null;
  }

  /**
   * Whether a subscription is for a membership.
   */
  private isMembership(subscription: Stripe.Subscription) {
    const product = subscription.items.data[0]?.plan?.product;
    if (!product) {
      return false;
    }

    if (typeof product === "string") {
      return product === SubscriptionManager.productId;
    } else {
      return product.id === SubscriptionManager.productId;
    }
  }

  private formatMemberAlert(
    subscription: Stripe.Subscription,
  ): MemberAlertMessage {
    return {
      type: "member_alert",
      id: this.createObjectId(subscription),
      date: new Date(subscription.created * 1000).toISOString(),
      productName: "New Member",
    };
  }

  private formatChargeAlert(
    paymentIntent: Stripe.PaymentIntent,
  ): ChargeAlertMessage {
    return {
      type: "charge_alert",
      id: this.createObjectId(paymentIntent),
      date: new Date(paymentIntent.created * 1000).toISOString(),
      amount: { cents: paymentIntent.amount ?? 0 },
      productName: this.getProductName(paymentIntent),
    };
  }

  private broadcastAlert(alert: AlertMessage) {
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

  private createObjectId(
    object: Stripe.PaymentIntent | Stripe.Subscription,
  ): string {
    return crypto
      .createHash("sha256")
      .update(object.id)
      .digest("hex")
      .slice(0, 12);
  }

  private getProductName(paymentIntent: Stripe.PaymentIntent): string {
    const name = paymentIntent.metadata?.["name"] ?? paymentIntent.description;
    if (!name) {
      return GENERAL_DONATION;
    }

    const remapped = NAME_REMAP[name] ?? name;
    return obscenityCensor.applyTo(
      remapped,
      obscenityMatcher.getAllMatches(remapped),
    );
  }
}

const chargeAlertManager = new ChargeAlertManager();
export default chargeAlertManager;

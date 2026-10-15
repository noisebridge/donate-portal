import crypto from "node:crypto";
import type { WebSocket } from "@fastify/websocket";
import {
  DataSet,
  englishDataset,
  englishRecommendedTransformers,
  RegExpMatcher,
  TextCensor,
} from "obscenity";
import type Stripe from "stripe";
import baseLogger from "~/lib/logger";
import stripe from "~/services/stripe";
import type {
  AlertMessage,
  ChargeAlertMessage,
  MemberAlertMessage,
  PingMessage,
} from "~/types/alerts";
import { GENERAL_DONATION, NAME_REMAP } from "./donation";
import { PRODUCT_ID } from "./subscription";

const MAX_RECENT_ALERTS = 25;
const PING_HISTORY_SIZE = 5;
const PING_INTERVAL_MS = 30_000;

function buildObscenityFilter() {
  const obscenityDataset = new DataSet<{ originalWord: string }>()
    .addAll(englishDataset)
    // We have a "Give a shit" donation so we should pass that through
    .removePhrasesIf((phrase) => phrase.metadata?.originalWord === "shit");

  const obscenityMatcher = new RegExpMatcher({
    ...obscenityDataset.build(),
    ...englishRecommendedTransformers,
  });

  const textCensor = new TextCensor();

  return (input: string) => {
    return textCensor.applyTo(input, obscenityMatcher.getAllMatches(input));
  };
}
const obscenityFilter = buildObscenityFilter();

export class ChargeAlertManager {
  static readonly log = baseLogger.child({ module: "charge-alert" });

  private _recentAlerts: AlertMessage[] | null = null;
  private sockets = new Set<WebSocket>();

  async getRecentAlerts() {
    if (this._recentAlerts === null) {
      this._recentAlerts = await this.fetchRecentAlerts();
    }

    return this._recentAlerts;
  }

  addConnection(socket: WebSocket) {
    this.sockets.add(socket);

    // Browsers answer protocol pings on their own. The history message tells
    // the client the server is still there and fills in alerts it missed.
    let alive = true;
    socket.on("pong", () => {
      alive = true;
    });

    const heartbeat = setInterval(async () => {
      if (!alive) {
        ChargeAlertManager.log.warn("Terminating unresponsive connection");
        socket.terminate();
        return;
      }

      alive = false;
      socket.ping();
      const history = await this.getRecentAlerts();
      const message: PingMessage = {
        type: "ping",
        history: history.slice(0, PING_HISTORY_SIZE),
      };
      socket.send(JSON.stringify(message));
    }, PING_INTERVAL_MS);
    // Allows the process to terminate even when the interval is running.
    heartbeat.unref();

    socket.on("error", (err) => {
      ChargeAlertManager.log.error({ err }, "Error on socket");
    });

    // ws emits close after error and terminate too.
    socket.on("close", () => {
      clearInterval(heartbeat);
      this.sockets.delete(socket);
    });
  }

  async handlePaymentSuccess(event: Stripe.PaymentIntentSucceededEvent) {
    const paymentIntent = event.data.object;
    if (!this.isDonation(paymentIntent)) {
      return;
    }

    await this.broadcastAlert(this.formatChargeAlert(paymentIntent));
  }

  async handleNewSubscription(event: Stripe.CustomerSubscriptionCreatedEvent) {
    const subscription = event.data.object;
    if (!this.isMembership(subscription)) {
      return;
    }

    await this.broadcastAlert(this.formatMemberAlert(event.data.object));
  }

  /**
   * Fetch recent one-time payments and new subscriptions from Stripe,
   * interleaved by date descending.
   */
  private async fetchRecentAlerts(): Promise<AlertMessage[]> {
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
    const product = subscription.items.data[0]?.price.product;
    if (!product) {
      return false;
    }

    const productId = typeof product === "string" ? product : product.id;
    return productId === PRODUCT_ID;
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

  private async broadcastAlert(alert: AlertMessage) {
    const history = await this.getRecentAlerts();
    if (history.unshift(alert) > MAX_RECENT_ALERTS) {
      history.pop();
    }

    const message = JSON.stringify(alert);
    for (const socket of this.sockets) {
      socket.send(message);
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
    return obscenityFilter(remapped);
  }
}

const chargeAlertManager = new ChargeAlertManager();
export default chargeAlertManager;

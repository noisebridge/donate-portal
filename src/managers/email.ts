import config from "~/config";
import { MagicLinkEmail } from "~/emails/magic-link";
import { SubscriptionCanceledEmail } from "~/emails/subscription-canceled";
import { SubscriptionPastDueEmail } from "~/emails/subscription-past-due";
import { SubscriptionUpdatedEmail } from "~/emails/subscription-updated";
import { SubscriptionWelcomeEmail } from "~/emails/subscription-welcome";
import baseLogger from "~/lib/logger";
import magicLinkManager from "~/managers/magic-link";
import resend from "~/services/email";
import type { Cents } from "~/types/cents";

export type EmailResult =
  | { success: true; id: string }
  | { success: false; error: string };

class EmailManager {
  static readonly log = baseLogger.child({ class: "EmailManager" });
  static readonly fromAddress = `Noisebridge <${config.emailSender}>`;
  static readonly emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  isValidEmail(email: string): boolean {
    return email.length <= 254 && EmailManager.emailPattern.test(email);
  }

  private async send(params: {
    to: string;
    subject: string;
    html: string;
  }): Promise<EmailResult> {
    const { data, error } = await resend.emails.send({
      from: EmailManager.fromAddress,
      ...params,
    });
    if (error) {
      EmailManager.log.error(
        { error, to: params.to },
        "Email send returned error",
      );
      return { success: false, error: error.message };
    }

    return { success: true, id: data.id };
  }

  async sendMagicLinkEmail(email: string): Promise<EmailResult> {
    const magicLinkUrl = magicLinkManager.generateMagicLinkUrl(email);
    const emailHtml = await MagicLinkEmail({ magicLinkUrl });

    return await this.send({
      to: email,
      subject: "Sign in to donate.noisebridge.net",
      html: emailHtml,
    });
  }

  async sendSubscriptionCanceledEmail(
    email: string,
    amount?: Cents,
  ): Promise<EmailResult> {
    const emailHtml = await SubscriptionCanceledEmail({ amount });

    return await this.send({
      to: email,
      subject: "Your monthly donation to Noisebridge has been canceled",
      html: emailHtml,
    });
  }

  async sendSubscriptionWelcomeEmail(
    email: string,
    amount: Cents,
  ): Promise<EmailResult> {
    const emailHtml = await SubscriptionWelcomeEmail({ amount });

    return await this.send({
      to: email,
      subject: "Welcome! Your monthly donation to Noisebridge is set up",
      html: emailHtml,
    });
  }

  async sendSubscriptionPastDueEmail(
    email: string,
    amount?: Cents,
  ): Promise<EmailResult> {
    const emailHtml = await SubscriptionPastDueEmail({ amount });

    return await this.send({
      to: email,
      subject: "Payment issue with your Noisebridge donation",
      html: emailHtml,
    });
  }

  async sendSubscriptionUpdatedEmail(
    email: string,
    oldAmount: Cents,
    newAmount: Cents,
  ): Promise<EmailResult> {
    const emailHtml = await SubscriptionUpdatedEmail({ oldAmount, newAmount });

    return await this.send({
      to: email,
      subject: "Your Noisebridge donation amount has been updated",
      html: emailHtml,
    });
  }
}

const emailManager = new EmailManager();
export default emailManager;

import config from "~/config";
import { MagicLinkEmail } from "~/emails/magic-link";
import { SubscriptionCanceledEmail } from "~/emails/subscription-canceled";
import { SubscriptionPastDueEmail } from "~/emails/subscription-past-due";
import { SubscriptionUpdatedEmail } from "~/emails/subscription-updated";
import { SubscriptionWelcomeEmail } from "~/emails/subscription-welcome";
import type { Cents } from "~/money";
import resend from "~/services/resend";
import magicLinkManager from "./magic-link";

class EmailManager {
  static readonly fromAddress = `Noisebridge <${config.emailDomain}>`;

  async sendMagicLinkEmail(email: string) {
    const magicLinkUrl = magicLinkManager.generateMagicLinkUrl(email);
    const emailHtml = MagicLinkEmail({ magicLinkUrl });

    return await resend.emails.send({
      from: EmailManager.fromAddress,
      to: [email],
      subject: "Sign in to donate.noisebridge.net",
      html: emailHtml,
    });
  }

  async sendSubscriptionCanceledEmail(email: string, amount?: Cents) {
    const emailHtml = SubscriptionCanceledEmail({ amount });

    return await resend.emails.send({
      from: EmailManager.fromAddress,
      to: [email],
      subject: "Your monthly donation to Noisebridge has been canceled",
      html: emailHtml,
    });
  }

  async sendSubscriptionWelcomeEmail(email: string, amount: Cents) {
    const emailHtml = SubscriptionWelcomeEmail({ amount });

    return await resend.emails.send({
      from: EmailManager.fromAddress,
      to: [email],
      subject: "Welcome! Your monthly donation to Noisebridge is set up",
      html: emailHtml,
    });
  }

  async sendSubscriptionPastDueEmail(email: string, amount?: Cents) {
    const emailHtml = SubscriptionPastDueEmail({ amount });

    return await resend.emails.send({
      from: EmailManager.fromAddress,
      to: [email],
      subject: "Payment issue with your Noisebridge donation",
      html: emailHtml,
    });
  }

  async sendSubscriptionUpdatedEmail(
    email: string,
    oldAmount: Cents,
    newAmount: Cents,
  ) {
    const emailHtml = SubscriptionUpdatedEmail({ oldAmount, newAmount });

    return await resend.emails.send({
      from: EmailManager.fromAddress,
      to: [email],
      subject: "Your Noisebridge donation amount has been updated",
      html: emailHtml,
    });
  }
}

const emailManager = new EmailManager();
export default emailManager;

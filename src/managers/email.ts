import { MagicLinkEmail } from "~/emails/magic-link";
import { SubscriptionCanceledEmail } from "~/emails/subscription-canceled";
import resend from "~/services/resend";
import magicLinkManager from "./magic-link";

class EmailManager {
  static fromAddress = "Noisebridge <onboarding@resend.dev>";

  async sendMagicLinkEmail(email: string) {
    const magicLinkUrl = magicLinkManager.generateMagicLinkUrl(email);
    const emailHtml = MagicLinkEmail({
      email,
      magicLinkUrl,
    });

    return await resend.emails.send({
      from: EmailManager.fromAddress,
      to: [email],
      subject: "Sign in to donate.noisebridge.net",
      html: emailHtml,
    });
  }

  async sendSubscriptionCanceledEmail(email: string, amountCents: number) {
    const emailHtml = SubscriptionCanceledEmail({
      amountCents,
    });

    return await resend.emails.send({
      from: EmailManager.fromAddress,
      to: [email],
      subject: "Your Noisebridge donation has been canceled",
      html: emailHtml,
    });
  }
}

const emailManager = new EmailManager();
export default emailManager;

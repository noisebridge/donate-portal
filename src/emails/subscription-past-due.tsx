import config from "~/config";
import paths from "~/lib/paths";
import type { Cents } from "~/types/cents";
import { AmountSummary } from "./components/amount-summary";
import { CallToAction } from "./components/call-to-action";
import { Divider } from "./components/divider";
import { EmailLayout } from "./components/layout";
import { FinePrint, Heading, Paragraph } from "./components/text";

export interface SubscriptionPastDueEmailProps {
  amount?: Cents | undefined;
}

/**
 * Generate HTML email for subscription payment past due
 */
export function SubscriptionPastDueEmail({
  amount,
}: SubscriptionPastDueEmailProps) {
  const signInUrl = `${config.baseUrl}${paths.signIn()}`;
  return (
    <EmailLayout title="Payment Issue with Your Donation">
      <Heading>Payment Issue with Your Donation</Heading>
      <Paragraph bottom={20}>
        We were unable to process your monthly donation to Noisebridge.
      </Paragraph>
      {amount && (
        <AmountSummary
          label="Monthly Donation Amount"
          amount={amount}
          variant="muted"
        />
      )}
      <Paragraph top={30}>
        Please update your payment method to continue supporting Noisebridge.
      </Paragraph>
      <CallToAction href={signInUrl} top={20}>
        Sign In
      </CallToAction>
      <FinePrint top={20}>
        Once signed in, click "Past invoices &amp; payment method".
      </FinePrint>
      <Divider />
      <FinePrint>
        Thank you for your continued support of Noisebridge!
      </FinePrint>
    </EmailLayout>
  );
}

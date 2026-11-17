import config from "~/config";
import type { Cents } from "~/types/cents";
import { AmountSummary } from "./components/amount-summary";
import { Divider } from "./components/divider";
import { EmailLayout } from "./components/layout";
import { FinePrint, Heading, Paragraph } from "./components/text";

export interface SubscriptionCanceledEmailProps {
  amount?: Cents | undefined;
}

/**
 * Generate HTML email for subscription cancellation
 */
export function SubscriptionCanceledEmail({
  amount,
}: SubscriptionCanceledEmailProps) {
  return (
    <EmailLayout title="Your Donation Has Been Canceled">
      <Heading>Your Donation Has Been Canceled</Heading>
      <Paragraph bottom={20}>
        Your monthly donation to Noisebridge has been successfully canceled.
      </Paragraph>
      {amount && (
        <AmountSummary
          label="Canceled Monthly Amount"
          amount={amount}
          variant="muted"
        />
      )}
      <Paragraph top={30}>
        Your recurring donation has been canceled and you will not be charged
        again.
      </Paragraph>
      <Paragraph top={20}>
        We hope you'll consider supporting Noisebridge again in the future. You
        can set up a new donation anytime at{" "}
        <a href={config.baseUrl}>{config.baseUrl}</a>
      </Paragraph>
      <Divider />
      <FinePrint>Thank you for your past support of Noisebridge!</FinePrint>
    </EmailLayout>
  );
}

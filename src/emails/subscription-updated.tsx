import config from "~/config";
import paths from "~/lib/paths";
import type { Cents } from "~/types/cents";
import { AmountSummary } from "./components/amount-summary";
import { Divider } from "./components/divider";
import { EmailLayout } from "./components/layout";
import { FinePrint, Heading, Paragraph } from "./components/text";

export interface SubscriptionUpdatedEmailProps {
  oldAmount: Cents;
  newAmount: Cents;
}

/**
 * Generate HTML email for subscription amount change
 */
export function SubscriptionUpdatedEmail({
  oldAmount,
  newAmount,
}: SubscriptionUpdatedEmailProps) {
  const signInUrl = `${config.baseUrl}${paths.signIn()}`;
  return (
    <EmailLayout title="Your Donation Has Been Updated">
      <Heading>Your Donation Has Been Updated</Heading>
      <Paragraph bottom={20}>
        Your monthly donation amount to Noisebridge has been changed.
      </Paragraph>
      <AmountSummary
        label="Previous Amount"
        amount={oldAmount}
        variant="crossed"
      />
      <AmountSummary
        label="New Monthly Amount"
        amount={newAmount}
        variant="accent"
      />
      <Paragraph top={30}>
        Your new donation amount will take effect on your next billing cycle.
      </Paragraph>
      <Paragraph top={20}>
        Sign in to manage your donation <a href={signInUrl}>{signInUrl}</a>
      </Paragraph>
      <Divider />
      <FinePrint>
        Thank you for your continued support of Noisebridge!
      </FinePrint>
    </EmailLayout>
  );
}

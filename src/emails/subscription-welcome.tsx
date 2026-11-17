import config from "~/config";
import paths from "~/lib/paths";
import type { Cents } from "~/types/cents";
import { AmountSummary } from "./components/amount-summary";
import { Divider } from "./components/divider";
import { EmailLayout } from "./components/layout";
import { FinePrint, Heading, Paragraph } from "./components/text";

export interface SubscriptionWelcomeEmailProps {
  amount: Cents;
}

/**
 * Generate HTML email for new subscription welcome
 */
export function SubscriptionWelcomeEmail({
  amount,
}: SubscriptionWelcomeEmailProps) {
  const signInUrl = `${config.baseUrl}${paths.signIn()}`;
  return (
    <EmailLayout title="Thank You for Your Support!">
      <Heading>Thank You for Your Support!</Heading>
      <Paragraph bottom={20}>
        Your monthly donation to Noisebridge has been set up successfully.
      </Paragraph>
      <AmountSummary
        label="Monthly Donation Amount"
        amount={amount}
        variant="accent"
      />
      <Paragraph top={30}>
        Your support helps keep Noisebridge running and accessible to everyone.
        You'll be charged this amount each month.
      </Paragraph>
      <Paragraph top={20}>
        Sign in to manage your donation <a href={signInUrl}>{signInUrl}</a>
      </Paragraph>
      <Divider />
      <FinePrint>Thank you for supporting Noisebridge!</FinePrint>
    </EmailLayout>
  );
}

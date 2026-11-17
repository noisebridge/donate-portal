import { CallToAction } from "./components/call-to-action";
import { Divider } from "./components/divider";
import { EmailLayout } from "./components/layout";
import {
  FallbackLink,
  FinePrint,
  Heading,
  Note,
  Paragraph,
} from "./components/text";

export interface MagicLinkEmailProps {
  magicLinkUrl: string;
}

/**
 * Generate HTML email for magic link authentication
 */
export function MagicLinkEmail({ magicLinkUrl }: MagicLinkEmailProps) {
  return (
    <EmailLayout title="Sign in to donate.noisebridge.net">
      <Heading>Sign in to Noisebridge</Heading>
      <Paragraph bottom={30}>
        You requested a magic link to sign in to manage your Noisebridge
        donation.
      </Paragraph>
      <CallToAction href={magicLinkUrl}>Sign In</CallToAction>
      <Note top={30}>This link will expire in 5 minutes.</Note>
      <Divider />
      <FinePrint>
        If you didn't request this email, you can safely ignore it.
      </FinePrint>
      <FinePrint>Or copy and paste this link into your browser:</FinePrint>
      <FallbackLink href={magicLinkUrl} top={10} />
    </EmailLayout>
  );
}

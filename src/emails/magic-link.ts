import { Layout } from "./layout";

export interface MagicLinkEmailProps {
  magicLinkUrl: string;
}

/**
 * Generate HTML email for magic link authentication
 */
export function MagicLinkEmail({ magicLinkUrl }: MagicLinkEmailProps): string {
  return Layout(
    "Sign in to donate.noisebridge.net",
    `
    <mj-text font-size="24px" font-weight="700" color="#333333" align="center" padding-bottom="20px">
      Sign in to Noisebridge
    </mj-text>
    <mj-text align="center" padding-bottom="30px">
      You requested a magic link to sign in to manage your Noisebridge donation.
    </mj-text>
    <mj-button href="${magicLinkUrl}" align="center">
      Sign In
    </mj-button>
    <mj-text align="center" color="#888888" font-size="13px" padding-top="30px">
      This link will expire in 5 minutes.
    </mj-text>
    <mj-divider border-color="#e0e0e0" padding="30px 0 20px 0" />
    <mj-text align="center" color="#888888" font-size="12px">
      If you didn't request this email, you can safely ignore it.
    </mj-text>
    <mj-text align="center" color="#888888" font-size="12px">
      Or copy and paste this link into your browser:
    </mj-text>
    <mj-text align="center" color="#0066cc" font-size="11px" padding-top="10px">
      ${magicLinkUrl}
    </mj-text>
  `,
  );
}

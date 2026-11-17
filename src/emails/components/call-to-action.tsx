import type { Children } from "~/lib/jsx/jsx-runtime";
import { fontStack, Row, type Spacing } from "./row";

export interface CallToActionProps extends Spacing {
  /** Where the button links to. */
  href: string;
  children: Children;
}

/** The styled button at the heart of the email. */
export function CallToAction({
  href,
  top,
  bottom,
  children,
}: CallToActionProps) {
  return (
    <Row padding="12px 32px" top={top} bottom={bottom}>
      <table
        border={0}
        cellpadding="0"
        cellspacing="0"
        role="presentation"
        style="border-collapse:separate;line-height:100%;"
      >
        <tbody>
          <tr>
            <td
              align="center"
              bgcolor="#cc3333"
              role="presentation"
              style="border:none;border-radius:6px;cursor:auto;mso-padding-alt:10px 25px;background:#cc3333;"
              valign="middle"
            >
              <a
                href={href}
                style={`display:inline-block;background:#cc3333;color:#ffffff;font-family:${fontStack};font-size:16px;font-weight:600;line-height:120%;margin:0;text-decoration:none;text-transform:none;padding:10px 25px;mso-padding-alt:0px;border-radius:6px;`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {children}
              </a>
            </td>
          </tr>
        </tbody>
      </table>
    </Row>
  );
}

import type { Children, PropsWithChildren } from "~/lib/jsx/jsx-runtime";
import { bodyWidth, contentWidth } from "./row";
import { TextBlock } from "./text";
import { When } from "./when";

const baseStyles = `
  #outlook a { padding:0; }
  body { margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%; }
  table, td { border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt; }
  img { border:0;height:auto;line-height:100%; outline:none;text-decoration:none;-ms-interpolation-mode:bicubic; }
  p { display:block;margin:13px 0; }
`;

const outlookGroupFixStyles = `.email-outlook-group-fix { width:100% !important; }`;

const responsiveStyles = `@media only screen and (min-width:480px) {
  .email-column { width:100% !important; max-width: 100%; }
}`;

const mozillaColumnFix = `.moz-text-html .email-column { width:100% !important; max-width: 100%; }`;

interface SectionProps {
  /** Background color of the section, when it is a raised card. */
  background?: string | undefined;
  /** Padding of the section's cell. */
  padding: string;
  children: Children;
}

/**
 * One full-width band of the email: an outer table (so Outlook keeps the
 * body width) wrapping the content column.
 */
function Section({ background, padding, children }: SectionProps) {
  const bg =
    background != null
      ? `background:${background};background-color:${background};`
      : "";
  return (
    <When
      condition="mso | IE"
      wrap={(hole) => (
        <table
          align="center"
          border={0}
          cellpadding={0}
          cellspacing={0}
          role="presentation"
          style={`width:${bodyWidth}px;`}
          width={bodyWidth}
          bgcolor={background}
        >
          <tr>
            <td style="line-height:0px;font-size:0px;mso-line-height-rule:exactly;">
              {hole}
            </td>
          </tr>
        </table>
      )}
    >
      <div style={`${bg}margin:0px auto;max-width:${bodyWidth}px;`}>
        <table
          align="center"
          border={0}
          cellpadding={0}
          cellspacing={0}
          role="presentation"
          style={`${bg}width:100%;`}
        >
          <tbody>
            <tr>
              <td
                style={`direction:ltr;font-size:0px;padding:${padding};text-align:center;`}
              >
                <When
                  condition="mso | IE"
                  wrap={(hole) => (
                    <table
                      role="presentation"
                      border={0}
                      cellpadding={0}
                      cellspacing={0}
                    >
                      <tr>
                        <td
                          style={`vertical-align:top;width:${contentWidth}px;`}
                        >
                          {hole}
                        </td>
                      </tr>
                    </table>
                  )}
                >
                  <div
                    class="email-column email-outlook-group-fix"
                    style="font-size:0px;text-align:left;direction:ltr;display:inline-block;vertical-align:top;width:100%;"
                  >
                    <table
                      border={0}
                      cellpadding={0}
                      cellspacing={0}
                      role="presentation"
                      style="vertical-align:top;"
                      width="100%"
                    >
                      <tbody>{children}</tbody>
                    </table>
                  </div>
                </When>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </When>
  );
}

export type EmailLayoutProps = PropsWithChildren<{
  /** The email's subject line, used as the document title. */
  title: string;
}>;

/** The document shell every email is rendered into. */
export function EmailLayout({ title, children }: EmailLayoutProps) {
  return (
    <html
      lang="en"
      dir="auto"
      xmlns="http://www.w3.org/1999/xhtml"
      xmlns:v="urn:schemas-microsoft-com:vml"
      xmlns:o="urn:schemas-microsoft-com:office:office"
    >
      <head>
        <title>{title}</title>
        <When condition="!mso">
          <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        </When>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style
          type="text/css"
          dangerouslySetInnerHTML={{ __html: baseStyles }}
        />
        <When condition="mso">
          <noscript>
            <xml>
              <o:OfficeDocumentSettings>
                <o:AllowPNG />
                <o:PixelsPerInch>96</o:PixelsPerInch>
              </o:OfficeDocumentSettings>
            </xml>
          </noscript>
        </When>
        <When condition="lte mso 11">
          <style
            type="text/css"
            dangerouslySetInnerHTML={{ __html: outlookGroupFixStyles }}
          />
        </When>
        <style
          type="text/css"
          dangerouslySetInnerHTML={{ __html: responsiveStyles }}
        />
        <style
          media="screen and (min-width:480px)"
          dangerouslySetInnerHTML={{ __html: mozillaColumnFix }}
        />
      </head>
      <body style="word-spacing:normal;background-color:#f4f4f4;">
        <div
          role="article"
          aria-label={title}
          aria-roledescription="email"
          lang="en"
          dir="auto"
          style="word-spacing:normal;background-color:#f4f4f4;"
        >
          <Section background="#ffffff" padding="40px 20px">
            {children}
          </Section>
          <Section padding="20px">
            <TextBlock size={12} color="#999999">
              Noisebridge Hackerspace
            </TextBlock>
          </Section>
        </div>
      </body>
    </html>
  );
}

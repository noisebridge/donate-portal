import mjml2html from "mjml";

export function Layout(contents: string): string {
  const mjml = `
    <mjml>
      <mj-head>
        <mj-title>Sign in to Noisebridge Donations</mj-title>
        <mj-attributes>
          <mj-all font-family="'Helvetica Neue', Helvetica, Arial, sans-serif" />
          <mj-text font-size="14px" color="#555555" line-height="1.6" />
          <mj-button background-color="#cc3333" color="#ffffff" font-size="16px" font-weight="600" border-radius="6px" padding="12px 32px" />
        </mj-attributes>
      </mj-head>
      <mj-body background-color="#f4f4f4">
        <mj-section background-color="#ffffff" padding="40px 20px">
          <mj-column>
            ${contents}
          </mj-column>
        </mj-section>
        <mj-section padding="20px">
          <mj-column>
            <mj-text align="center" color="#999999" font-size="12px">
              Noisebridge Hackerspace
            </mj-text>
          </mj-column>
        </mj-section>
      </mj-body>
    </mjml>
  `;

  const { html, errors } = mjml2html(mjml);
  if (errors.length > 0) {
    console.error("MJML compilation errors:", errors);
    throw new Error("Failed to generate HTML from MJML");
  }

  return html;
}

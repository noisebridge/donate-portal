import { contentWidth, Row } from "./row";
import { When } from "./when";

/** A horizontal rule separating the email body from the closing words. */
export function Divider() {
  return (
    <Row padding="30px 0 20px 0">
      <p style="border-top:solid 4px #e0e0e0;font-size:1px;margin:0px auto;width:100%;"></p>
      <When condition="mso | IE">
        <table
          align="center"
          border={0}
          cellpadding={0}
          cellspacing={0}
          style={`border-top:solid 4px #e0e0e0;font-size:1px;margin:0px auto;width:${contentWidth}px;`}
          role="presentation"
          width={`${contentWidth}px`}
        >
          <tr>
            <td style="height:0;line-height:0;">{" \u00a0"}</td>
          </tr>
        </table>
      </When>
    </Row>
  );
}

import { describe, expect, test } from "bun:test";
import { When } from "./when";

describe("When", () => {
  test("wraps children in a conditional comment", () => {
    expect(
      String(
        <When condition="mso">
          <b>hi</b>
        </When>,
      ),
    ).toBe("<!--[if mso]><b>hi</b><![endif]-->");
  });

  test("reveals negated content to clients without conditional comments", () => {
    expect(
      String(
        <When condition="!mso">
          <meta http-equiv="X-UA-Compatible" content="IE=edge" />
        </When>,
      ),
    ).toBe(
      '<!--[if !mso]><!--><meta http-equiv="X-UA-Compatible" content="IE=edge"><!--<![endif]-->',
    );
  });

  test("splits a fallback wrapper around content every client sees", () => {
    expect(
      String(
        <When
          condition="mso | IE"
          wrap={(hole) => (
            <table>
              <tr>
                <td>{hole}</td>
              </tr>
            </table>
          )}
        >
          <div>visible</div>
        </When>,
      ),
    ).toBe(
      "<!--[if mso | IE]><table><tr><td><![endif]-->" +
        "<div>visible</div>" +
        "<!--[if mso | IE]></td></tr></table><![endif]-->",
    );
  });

  test("escapes plain string children", () => {
    expect(String(<When condition="mso">{"<b>"}</When>)).toBe(
      "<!--[if mso]>&lt;b&gt;<![endif]-->",
    );
  });

  test("allows nested conditionals inside a fallback wrapper", () => {
    expect(
      String(
        <When
          condition="mso | IE"
          wrap={(hole) => (
            <table>
              <tr>
                <td>{hole}</td>
              </tr>
            </table>
          )}
        >
          <When condition="mso">
            <b>hi</b>
          </When>
        </When>,
      ),
    ).toBe(
      "<!--[if mso | IE]><table><tr><td><![endif]-->" +
        "<!--[if mso]><b>hi</b><![endif]-->" +
        "<!--[if mso | IE]></td></tr></table><![endif]-->",
    );
  });

  test("only a top-level negation uses the revealed form", () => {
    expect(String(<When condition="!mso | IE">hi</When>)).toBe(
      "<!--[if !mso | IE]>hi<![endif]-->",
    );
  });

  test("rejects a condition that would break out of the comment", () => {
    expect(() => String(<When condition="mso]><script>">hi</When>)).toThrow(
      TypeError,
    );
  });

  test("rejects a wrapper that never uses the hole", () => {
    expect(() =>
      String(
        <When condition="mso" wrap={() => <table />}>
          hi
        </When>,
      ),
    ).toThrow();
  });

  test("rejects a wrapper that uses the hole twice", () => {
    expect(() =>
      String(
        <When
          condition="mso"
          wrap={(hole) => (
            <>
              {hole}
              {hole}
            </>
          )}
        >
          hi
        </When>,
      ),
    ).toThrow();
  });
});

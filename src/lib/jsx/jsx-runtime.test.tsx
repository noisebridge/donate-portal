import { describe, expect, test } from "bun:test";
import type { Children, PropsWithChildren } from "./jsx-runtime";

const payload = `<script>alert("x" & 'y')</script>`;
const escaped =
  "&lt;script&gt;alert(&quot;x&quot; &amp; &#x27;y&#x27;)&lt;/script&gt;";

describe("jsx-runtime", () => {
  test("escapes string children", () => {
    expect(String(<p>{payload}</p>)).toBe(`<p>${escaped}</p>`);
  });

  test("escapes attribute values", () => {
    expect(String(<div title={payload} />)).toBe(
      `<div title="${escaped}"></div>`,
    );
  });

  test("does not escape nested elements", () => {
    expect(
      String(
        <p>
          <b>bold</b> text
        </p>,
      ),
    ).toBe("<p><b>bold</b> text</p>");
  });

  test("escapes objects that only look like elements", () => {
    const fake = { toString: () => "<b>" } as unknown as Children;
    expect(String(<p>{fake}</p>)).toBe("<p>&lt;b&gt;</p>");
  });

  test("escapes JSX text entities after the transpiler decodes them", () => {
    expect(String(<p>&copy; &times; &amp;</p>)).toBe("<p>© × &amp;</p>");
  });

  test("renders numbers, including zero", () => {
    expect(
      String(
        <p>
          {0} {1.5}
        </p>,
      ),
    ).toBe("<p>0 1.5</p>");
  });

  test("renders nothing for null, undefined and booleans", () => {
    expect(
      String(
        <p>
          {null}
          {undefined}
          {true}
          {false}
        </p>,
      ),
    ).toBe("<p></p>");
  });

  test("flattens nested arrays", () => {
    const items = ["a", "<b>"];
    expect(
      String(
        <ul>
          {items.map((item) => (
            <li>{item}</li>
          ))}
          {[["c", ["<d>"]]]}
        </ul>,
      ),
    ).toBe("<ul><li>a</li><li>&lt;b&gt;</li>c&lt;d&gt;</ul>");
  });

  test("renders true attributes bare and omits false and undefined", () => {
    expect(String(<input required checked={false} value={undefined} />)).toBe(
      "<input required>",
    );
  });

  test("stringifies number and hyphenated attributes", () => {
    expect(
      String(<div tabindex={-1} data-min={0.5} aria-hidden="true" />),
    ).toBe('<div tabindex="-1" data-min="0.5" aria-hidden="true"></div>');
  });

  test("leaves void elements unclosed", () => {
    expect(String(<br />)).toBe("<br>");
    expect(String(<img src="a.png" alt="" />)).toBe('<img src="a.png" alt="">');
  });

  test("closes empty non-void elements", () => {
    expect(String(<script src="a.js" />)).toBe('<script src="a.js"></script>');
  });

  test("prefixes <html> with a doctype", () => {
    expect(
      String(
        <html lang="en">
          <body />
        </html>,
      ),
    ).toBe('<!DOCTYPE html><html lang="en"><body></body></html>');
  });

  test("inserts dangerouslySetInnerHTML without escaping", () => {
    const json = '{"a":"<b>"}';
    expect(
      String(
        <script
          type="application/json"
          dangerouslySetInnerHTML={{ __html: json }}
        />,
      ),
    ).toBe(`<script type="application/json">${json}</script>`);
    expect(
      String(<style dangerouslySetInnerHTML={{ __html: "a > b {}" }} />),
    ).toBe("<style>a > b {}</style>");
  });

  test("renders components with props and children", () => {
    function Greeting({ name, children }: PropsWithChildren<{ name: string }>) {
      return (
        <p title={name}>
          Hi {name}
          {children}
        </p>
      );
    }

    expect(
      String(
        <Greeting name="<you>">
          <b>!</b>
        </Greeting>,
      ),
    ).toBe('<p title="&lt;you&gt;">Hi &lt;you&gt;<b>!</b></p>');
  });

  test("renders components that return null as nothing", () => {
    function Empty() {
      return null;
    }

    expect(String(<Empty />)).toBe("");
    expect(
      String(
        <div>
          <Empty />
        </div>,
      ),
    ).toBe("<div></div>");
  });

  test("renders fragments, escaping their strings", () => {
    expect(
      String(
        <>
          {payload}
          <br />
        </>,
      ),
    ).toBe(`${escaped}<br>`);
  });
});

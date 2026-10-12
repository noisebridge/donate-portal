/**
 * JSX runtime that renders straight to HTML strings. Every string it did not
 * produce itself is escaped; the only way to emit raw markup is the
 * `dangerouslySetInnerHTML` prop.
 */

/** Rendered markup. Only this module can create it, so it can be trusted. */
class Html {
  constructor(private readonly html: string) {}

  toString(): string {
    return this.html;
  }
}

export type { Html };

export type Children =
  | Html
  | string
  | number
  | boolean
  | null
  | undefined
  | Children[];

export type PropsWithChildren<T> = T & { children?: Children };

type Props = PropsWithChildren<{
  dangerouslySetInnerHTML?: { __html: string };
  [attribute: string]: unknown;
}>;

const voidElements = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "source",
  "track",
  "wbr",
]);

function render(children: Children): string {
  if (children instanceof Html) return children.toString();
  if (Array.isArray(children)) return children.map(render).join("");
  if (children == null || typeof children === "boolean") return "";
  return Bun.escapeHTML(children);
}

export function jsx(
  tag: string | ((props: Props) => Children),
  props: Props,
): Html {
  if (typeof tag === "function") return new Html(render(tag(props)));

  const { children, dangerouslySetInnerHTML, ...attributes } = props;
  // <html> is always a document root, which needs a doctype for standards mode.
  let html = tag === "html" ? "<!DOCTYPE html><html" : `<${tag}`;
  for (const [name, value] of Object.entries(attributes)) {
    if (value === true) html += ` ${name}`;
    else if (value != null && value !== false) {
      html += ` ${name}="${Bun.escapeHTML(String(value))}"`;
    }
  }
  if (voidElements.has(tag)) return new Html(`${html}>`);

  const inner = dangerouslySetInnerHTML?.__html ?? render(children);
  return new Html(`${html}>${inner}</${tag}>`);
}

export { jsx as jsxs };

export function Fragment({ children }: Props): Children {
  return children;
}

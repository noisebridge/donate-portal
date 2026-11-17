import type { Children } from "~/lib/jsx/jsx-runtime";
import { rawHtml } from "~/lib/jsx/jsx-runtime";
import { parseCondition } from "./condition";

/**
 * Marks where wrapped content goes inside fallback markup, so `When` can split
 * the rendered fallback into its open and close tags.
 */
const hole = "\u0000when-hole\u0000";

export interface WhenProps {
  /**
   * The MSO condition, e.g. "mso", "mso | IE", "lte mso 11", or "!mso".
   * A top-level `!` uses the escaped comment form, so browsers still see the
   * content while Outlook skips it.
   */
  condition: string;
  /**
   * Fallback markup that wraps the children in matching clients, e.g. the
   * ghost table Outlook needs around a section. Receives the hole where the
   * children render; the hole must be used exactly once, as a child.
   */
  wrap?: ((hole: Children) => Children) | undefined;
  children: Children;
}

/**
 * Emits an MSO conditional comment: matching clients (Outlook, IE) render the
 * markup inside it, every other client hides it in a comment.
 *
 * With `wrap`, the children render between two conditional islands carrying
 * the fallback's open and close tags — conditional comments cannot surround
 * live content, so a wrapping fallback is always split like this.
 */
export function When({ condition, wrap, children }: WhenProps) {
  const negated = parseCondition(condition).kind === "not";
  const open = `<!--[if ${condition}]>${negated ? "<!-->" : ""}`;
  const close = negated ? `<!--<![endif]-->` : `<![endif]-->`;

  if (!wrap) {
    return (
      <>
        {rawHtml(open)}
        {children}
        {rawHtml(close)}
      </>
    );
  }

  const parts = String(wrap(rawHtml(hole))).split(hole);
  if (parts.length !== 2) {
    throw new Error("When: wrap must use the hole exactly once");
  }
  const fallbackOpen = parts[0] ?? "";
  const fallbackClose = parts[1] ?? "";

  return (
    <>
      {rawHtml(`${open}${fallbackOpen}${close}`)}
      {children}
      {rawHtml(`${open}${fallbackClose}${close}`)}
    </>
  );
}

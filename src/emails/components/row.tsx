import type { Children } from "~/lib/jsx/jsx-runtime";

/** Font stack every email text inherits, matching the site's headings. */
export const fontStack = "'Helvetica Neue', Helvetica, Arial, sans-serif";

/** Width of the email body, in pixels. */
export const bodyWidth = 600;

/** Horizontal padding inside every section. */
const gutter = 20;

/** Width of the content column inside a section, in pixels. */
export const contentWidth = bodyWidth - 2 * gutter;

export interface Spacing {
  /** Extra space above the block, in pixels. */
  top?: number | undefined;
  /** Extra space below the block, in pixels. */
  bottom?: number | undefined;
}

/**
 * Compose cell padding: a base value plus any per-side overrides, the way
 * email clients merge inline style declarations.
 */
export function cellPadding(base: string, { top, bottom }: Spacing = {}) {
  let padding = `padding:${base};`;
  if (top != null) padding += `padding-top:${top}px;`;
  if (bottom != null) padding += `padding-bottom:${bottom}px;`;
  return padding;
}

interface RowProps extends Spacing {
  /** Cell alignment for the whole row. */
  align?: "left" | "center" | "right" | undefined;
  /** Base padding for the cell, before `top` and `bottom` overrides. */
  padding: string;
  class?: string | undefined;
  children: Children;
}

/** A single content row in the email's column table. */
export function Row({
  align = "center",
  padding,
  top,
  bottom,
  class: className,
  children,
}: RowProps) {
  return (
    <tr>
      <td
        align={align}
        class={className}
        style={`font-size:0px;${cellPadding(padding, { top, bottom })}word-break:break-word;`}
      >
        {children}
      </td>
    </tr>
  );
}

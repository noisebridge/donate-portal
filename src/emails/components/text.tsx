import type { Children, PropsWithChildren } from "~/lib/jsx/jsx-runtime";
import { fontStack, Row, type Spacing } from "./row";

interface TextBlockProps extends Spacing {
  /** Font size in pixels. */
  size: number;
  /** Text color. */
  color: string;
  /** Font weight, when heavier than normal. */
  weight?: number | undefined;
  /** Text decoration, e.g. a line-through for struck-out text. */
  decoration?: string | undefined;
  children: Children;
}

/** A row of centered text. The building block for all copy in an email. */
export function TextBlock({
  size,
  color,
  weight,
  decoration,
  top,
  bottom,
  children,
}: TextBlockProps) {
  const style =
    `font-family:${fontStack};font-size:${size}px;` +
    (weight != null ? `font-weight:${weight};` : "") +
    `line-height:1.6;text-align:center;color:${color};` +
    (decoration != null ? `text-decoration:${decoration};` : "");
  return (
    <Row padding="10px 25px" top={top} bottom={bottom}>
      <div style={style}>{children}</div>
    </Row>
  );
}

/** The email's headline. */
export function Heading({ children }: { children?: Children }) {
  return (
    <TextBlock size={24} weight={700} color="#333333" bottom={20}>
      {children}
    </TextBlock>
  );
}

/** Body copy. Inline links can be nested with `<a>`. */
export function Paragraph({
  top,
  bottom,
  children,
}: PropsWithChildren<Spacing>) {
  return (
    <TextBlock size={14} color="#555555" top={top} bottom={bottom}>
      {children}
    </TextBlock>
  );
}

/** A short secondary remark, quieter than body copy. */
export function Note({ top, bottom, children }: PropsWithChildren<Spacing>) {
  return (
    <TextBlock size={13} color="#888888" top={top} bottom={bottom}>
      {children}
    </TextBlock>
  );
}

/** Disclaimers and other small print at the bottom of the email. */
export function FinePrint({
  top,
  bottom,
  children,
}: PropsWithChildren<Spacing>) {
  return (
    <TextBlock size={12} color="#888888" top={top} bottom={bottom}>
      {children}
    </TextBlock>
  );
}

export interface FallbackLinkProps extends Spacing {
  /** The URL to show as plain text, for copy-pasting when links break. */
  href: string;
}

/** A URL shown as copyable text below the call to action. */
export function FallbackLink({ href, top, bottom }: FallbackLinkProps) {
  return (
    <TextBlock size={11} color="#0066cc" top={top} bottom={bottom}>
      {href}
    </TextBlock>
  );
}

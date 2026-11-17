import { Window } from "happy-dom";

/**
 * Parse a rendered email into a DOM so tests can assert on its structure.
 * Emails are full documents, so the caller gets the document back and can
 * query into it.
 */
export function parseEmail(html: string) {
  const window = new Window();
  window.document.write(html);
  return window.document;
}

/**
 * Parse a single block-level email component (which renders as a table row)
 * in a minimal table scaffold, for component-level assertions.
 */
export function parseEmailRow(html: string) {
  return parseEmail(`<table><tbody>${html}</tbody></table>`);
}

/**
 * An error whose title and description are safe and meaningful to show the
 * user. The route error handler renders these with a friendly page instead of
 * the raw message and stack trace.
 */
export class FriendlyError extends Error {
  constructor(
    readonly title: string,
    readonly description: string,
  ) {
    super(title);
    this.name = "FriendlyError";
  }
}

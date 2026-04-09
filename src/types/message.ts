export interface Message {
  type: "error" | "info";
  /**
   * Defaults to `true`
   */
  dismissable?: boolean;
  text: string;
}

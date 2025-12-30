import type { Message } from "./components/message-container";

export type MessageParams = Partial<Record<Message["type"], string>>;

/**
 * Format a page path with query params.
 */
function formatPath(path: string, params?: Record<string, string | undefined>) {
  if (!params || Object.keys(params).length === 0) {
    return path;
  }

  const urlSearchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (typeof value !== "string") {
      continue;
    }

    urlSearchParams.set(key, value);
  }

  const queryString = urlSearchParams.toString();
  if (!queryString) {
    return path;
  }

  return `${path}?${queryString}`;
}

// biome-ignore lint/suspicious/noExplicitAny: unknown didn't work here
type FunctionReturnsString = (...args: any[]) => string;

const paths = {
  index: (params?: MessageParams) => formatPath("/", params),
  donate: () => "/donate",
  thankYou: () => "/thank-you",
  qr: () => "/qr",
  signIn: (params?: MessageParams) => formatPath("/auth", params),
  emailAuth: (email?: string) => formatPath("/auth/email", { email }),
  emailCallback: (state?: string) =>
    formatPath("/auth/email/callback", { state }),
  authBackdoor: () => "/auth/backdoor",
  signOut: () => "/auth/signout",
  githubStart: () => "/auth/github/start",
  githubCallback: () => "/auth/github/callback",
  googleStart: () => "/auth/google/start",
  googleCallback: () => "/auth/google/callback",
  manage: (params?: MessageParams) => formatPath("/manage", params),
  subscribe: () => "/subscribe",
  stripePortal: () => "/subscribe/portal",
  cancel: () => "/cancel",
  webhook: () => "/webhook",
  healthz: () => "/healthz",
} as const satisfies Record<string, FunctionReturnsString>;

export default paths;

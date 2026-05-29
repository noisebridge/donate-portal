import type { Cents } from "~/types/cents";
import { assetHashes } from "./assets";
import type { ErrorCodeKey, InfoCodeKey } from "./error-codes";

export interface MessageParams {
  error?: ErrorCodeKey;
  info?: InfoCodeKey;
}

/**
 * Format a page path with query params.
 */
export function formatPath<T extends string>(
  path: string,
  params?: Partial<Record<T, string | number | undefined>>,
) {
  if (!params) {
    return path;
  }

  const urlSearchParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    switch (typeof value) {
      case "undefined":
        break;
      case "number":
        urlSearchParams.set(key, value.toString());
        break;
      case "string":
        urlSearchParams.set(key, value);
        break;
    }
  }

  const queryString = urlSearchParams.toString();
  if (!queryString) {
    return path;
  }

  return `${path}?${queryString}`;
}

type FunctionReturnsString = (...args: never[]) => string;

/**
 * Central location to define paths. This prevents inconsistencies within the
 * site with what the paths are or what query parameters they can receive. Each
 * path is noted with a comment containing the path string so that developers
 * can quickly see the path by hovering over one of these functions.
 */
const paths = {
  /**
   * `/`
   */
  index: (params?: MessageParams) => formatPath("/", params),
  /**
   * `/donate`
   */
  donate: () => "/donate",
  /**
   * `/thank-you`
   */
  thankYou: () => "/thank-you",
  /**
   * `/qr`
   */
  qr: (amount?: Cents, name?: string, description?: string) =>
    formatPath("/qr", {
      amount: amount && amount.cents / 100,
      name,
      description,
    }),
  /**
   * `/qr.svg`
   */
  qrSvg: (amount?: Cents, name?: string, description?: string) =>
    formatPath("/qr.svg", {
      amount: amount && amount.cents / 100,
      name,
      description,
    }),
  /**
   * `/qr-custom`
   */
  qrCustom: (amount?: Cents, name?: string, description?: string) =>
    formatPath("/qr-custom", {
      amount: amount && amount.cents / 100,
      name,
      description,
    }),
  /**
   * `/qr-editor`
   */
  qrEditor: () => "/qr-editor",
  /**
   * `/auth`
   */
  signIn: (params?: MessageParams) => formatPath("/auth", params),
  /**
   * `/auth/email`
   */
  emailAuth: (email?: string) => formatPath("/auth/email", { email }),
  /**
   * `/auth/email/callback`
   */
  emailCallback: (state?: string) =>
    formatPath("/auth/email/callback", { state }),
  /**
   * `/auth/signout`
   */
  signOut: () => "/auth/signout",
  /**
   * `/auth/github/start`
   */
  githubStart: () => "/auth/github/start",
  /**
   * `/auth/github/callback`
   */
  githubCallback: () => "/auth/github/callback",
  /**
   * `/auth/google/start`
   */
  googleStart: () => "/auth/google/start",
  /**
   * `/auth/google/callback`
   */
  googleCallback: () => "/auth/google/callback",
  /**
   * `/manage`
   */
  manage: (params?: MessageParams) => formatPath("/manage", params),
  /**
   * `/subscribe`
   */
  subscribe: () => "/subscribe",
  /**
   * `/subscribe/portal`
   */
  stripePortal: () => "/subscribe/portal",
  /**
   * `/cancel`
   */
  cancel: () => "/cancel",
  /**
   * `/alerts`
   */
  alerts: () => "/alerts",
  /**
   * `/alerts/ws`
   */
  alertsWs: () => "/alerts/ws",
  /**
   * `/webhook`
   */
  webhook: () => "/webhook",
  /**
   * `/error-reporting`
   */
  errorReporting: () => "/error-reporting",
  /**
   * `/csp-report`
   */
  cspReport: () => "/csp-report",
  /**
   * `/healthz`
   */
  healthz: () => "/healthz",
  /**
   * `/assets/:filePath`
   */
  asset: (filePath: string) => `/assets/${filePath}`,
  /**
   * `/assets/:filePath?v=$hash`
   */
  assetWithHash: (filePath: string) =>
    formatPath(`/assets/${filePath}`, { v: assetHashes.get(filePath) }),
} as const satisfies Record<string, FunctionReturnsString>;

export default paths;

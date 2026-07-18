import type { Cents } from "~/types/cents";
import { assetHashes } from "./assets";
import type { ErrorCodeKey, InfoCodeKey } from "./error-codes";

export interface MessageParams {
  error?: ErrorCodeKey | undefined;
  info?: InfoCodeKey | undefined;
}

/**
 * Format a page path with query params.
 */
export function formatPath<
  Path extends string,
  Params extends { [K in keyof Params]?: string | number | undefined },
>(path: Path, params?: Params) {
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

  return `${path}?${queryString}` as const;
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
  donate: () => "/donate" as const,
  /**
   * `/thank-you`
   */
  thankYou: () => "/thank-you" as const,
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
   * `/qr-editor`
   */
  qrEditor: () => "/qr-editor" as const,
  /**
   * `/afterparty`
   */
  afterparty: (params?: MessageParams & { price?: number }) =>
    formatPath("/afterparty", params),
  /**
   * `/afterparty/availability`
   */
  afterpartyAvailability: () => "/afterparty/availability" as const,
  /**
   * `/afterparty.ics`
   */
  afterpartyCalendar: () => "/afterparty.ics" as const,
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
  signOut: () => "/auth/signout" as const,
  /**
   * `/auth/github/start`
   */
  githubStart: () => "/auth/github/start" as const,
  /**
   * `/auth/github/callback`
   */
  githubCallback: () => "/auth/github/callback" as const,
  /**
   * `/auth/google/start`
   */
  googleStart: () => "/auth/google/start" as const,
  /**
   * `/auth/google/callback`
   */
  googleCallback: () => "/auth/google/callback" as const,
  /**
   * `/manage`
   */
  manage: (params?: MessageParams) => formatPath("/manage", params),
  /**
   * `/subscribe`
   */
  subscribe: () => "/subscribe" as const,
  /**
   * `/subscribe/portal`
   */
  stripePortal: () => "/subscribe/portal" as const,
  /**
   * `/cancel`
   */
  cancel: () => "/cancel" as const,
  /**
   * `/alerts`
   */
  alerts: () => "/alerts" as const,
  /**
   * `/alerts/ws`
   */
  alertsWs: () => "/alerts/ws" as const,
  /**
   * `/webhook`
   */
  webhook: () => "/webhook" as const,
  /**
   * `/error-reporting`
   */
  errorReporting: () => "/error-reporting" as const,
  /**
   * `/csp-report`
   */
  cspReport: () => "/csp-report" as const,
  /**
   * `/healthz`
   */
  healthz: () => "/healthz" as const,
  /**
   * `/assets/:filePath`
   */
  asset: (filePath: string) => `/assets/${filePath}` as const,
  /**
   * `/assets/:filePath?v=$hash`
   */
  assetWithHash: (filePath: string) =>
    formatPath(`/assets/${filePath}`, { v: assetHashes.get(filePath) }),
} as const satisfies Record<string, FunctionReturnsString>;

type PathMap = typeof paths;
export type Paths = {
  [K in keyof PathMap]: ReturnType<PathMap[K]>;
};

export default paths;

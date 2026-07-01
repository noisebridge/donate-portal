/**
 * Permissions-Policy configuration.
 *
 * Each policy entry is a partial directive map. Entries are merged by
 * deduplicating sources per directive, making it easy to add per-service
 * allowlists.
 */

import fp from "fastify-plugin";

const directives = [
  "accelerometer",
  "autoplay",
  "browsing-topics",
  "camera",
  "display-capture",
  "fullscreen",
  "geolocation",
  "gyroscope",
  "magnetometer",
  "microphone",
  "midi",
  "payment",
  "picture-in-picture",
  "publickey-credentials-get",
  "screen-wake-lock",
  "usb",
  "xr-spatial-tracking",
] as const;

type Directive = (typeof directives)[number];

export type PolicyEntry = Partial<Record<Directive, string[]>>;

export function mergePolicies(policies: PolicyEntry[]) {
  const merged: Record<string, Set<string>> = {};

  for (const policy of policies) {
    for (const [directive, sources] of Object.entries(policy)) {
      merged[directive] ??= new Set();
      for (const source of sources) {
        merged[directive].add(source);
      }
    }
  }

  return Object.fromEntries(
    Object.entries(merged).map(([k, v]) => [k, Array.from(v)]),
  );
}

const basePolicy: PolicyEntry = Object.fromEntries(
  directives.map((d) => [d, []]),
);

const stripePolicy: PolicyEntry = {
  payment: ["self", "https://js.stripe.com"],
};

function formatAllowList(sources: string[]): string {
  const formatted = sources.map((s) => (s === "self" ? "self" : `"${s}"`));
  return `(${formatted.join(" ")})`;
}

export function buildHeader(entries: PolicyEntry[]): string {
  const merged = mergePolicies(entries);
  return Object.entries(merged)
    .map(([directive, sources]) => `${directive}=${formatAllowList(sources)}`)
    .join(", ");
}

const permissionsPolicyHeader = buildHeader([basePolicy, stripePolicy]);

export default fp(async (fastify) => {
  fastify.addHook("onSend", async (_request, reply, payload) => {
    const contentType = reply.getHeader("content-type");
    if (contentType?.toString().includes("text/html")) {
      reply.header("Permissions-Policy", permissionsPolicyHeader);
    }

    return payload;
  });
});

/**
 * Content Security Policy configuration.
 *
 * Each policy entry is a partial CSP directive map. Entries are merged by
 * deduplicating sources per directive, making it easy to add per-service
 * allowlists without touching the base policy.
 */

import type { FastifyHelmetOptions } from "@fastify/helmet";

type Directive =
  | "default-src"
  | "script-src"
  | "style-src"
  | "img-src"
  | "font-src"
  | "connect-src"
  | "frame-src"
  | "frame-ancestors"
  | "form-action"
  | "base-uri";

type PolicyEntry = Partial<Record<Directive, string[]>>;

function mergePolicies(entries: PolicyEntry[]) {
  const merged: Record<string, Set<string>> = {};

  for (const entry of entries) {
    for (const [directive, sources] of Object.entries(entry)) {
      merged[directive] ??= new Set();
      for (const source of sources) {
        merged[directive].add(source);
      }
    }
  }

  // Remove 'none' CSP entries when a conflicting entry exists
  for (const sources of Object.values(merged)) {
    if (sources.size <= 1) continue;

    sources.delete("'none'");
  }

  return Object.fromEntries(
    Object.entries(merged).map(([k, v]) => [k, Array.from(v)]),
  );
}

const basePolicy: PolicyEntry = {
  "default-src": ["'self'"],
  "script-src": ["'self'"],
  "style-src": [
    "'self'",
    "'sha256-Xh3wDa6qwZqBwThpyOxhTUT9S+efeH5itF1geB9HuiI='", // layout.tsx <style>
    "'sha256-UoLkaMG1cxqNTYg4W8anPhBTc0jLpmUI1sw6oEnx6ZI='", // QR SVG inline style
    "'sha256-pNew6JVTI7o7/vyDz1vjbfN+ELdoCcdPQhWEliKkywA='", // QR SVG inline style
    "'unsafe-hashes'",
  ],
  "img-src": ["'self'"],
  "font-src": ["'self'"],
  "connect-src": ["'self'"],
  "frame-src": ["'none'"],
  "frame-ancestors": ["'none'"],
  "form-action": ["'self'"],
  "base-uri": ["'self'"],
};

const stripePolicy: PolicyEntry = {
  "script-src": ["https://js.stripe.com"],
  "connect-src": ["https://api.stripe.com"],
  "frame-src": ["https://js.stripe.com"],
  "form-action": ["https://billing.stripe.com"],
};

const ledPolicy: PolicyEntry = {
  "connect-src": ["http://localhost:3000"],
};

const policies = [basePolicy, stripePolicy, ledPolicy];

export const contentSecurityPolicy: NonNullable<
  FastifyHelmetOptions["contentSecurityPolicy"]
> = {
  directives: mergePolicies(policies),
  useDefaults: false,
};

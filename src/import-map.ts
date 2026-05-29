import { createHash } from "node:crypto";
import { assetHashes } from "~/assets";
import paths from "~/paths";

/**
 * Maps module specifiers to resolvable URLs.
 *
 * Keys ending with "/" act as path prefixes — their values must also end with "/".
 * When multiple keys match, the most specific (longest) key wins.
 */
export type ModuleSpecifierMap = Record<string, string>;

/**
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Element/script/type/importmap
 */
export interface ImportMap {
  imports?: ModuleSpecifierMap;
  scopes?: Record<string, ModuleSpecifierMap>;
  /** Maps module URLs to SubResource Integrity metadata strings. */
  integrity?: Record<string, string>;
}

function generateImportMap(): ImportMap {
  const imports: ModuleSpecifierMap = {};

  for (const filePath of assetHashes.keys()) {
    if (!filePath.endsWith(".mjs")) {
      continue;
    }

    imports[paths.asset(filePath)] = paths.assetWithHash(filePath);
  }

  return { imports };
}

const importMap = generateImportMap();
export const importMapJson = JSON.stringify(importMap);
export const importMapCspHash =
  `'sha256-${createHash("sha256").update(importMapJson).digest("base64")}'` as const;

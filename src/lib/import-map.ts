import { assetHashes } from "./assets";
import paths from "./paths";

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

/**
 * Create an import map that reroutes the absolute /assets URL of every
 * front-end .mjs file to the same URL with a cache-breaker attached. That way all static assets can be marked
 * as immutable, including JS, without worrying about stale cached versions of
 * transitive JS dependencies.
 */
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

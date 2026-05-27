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

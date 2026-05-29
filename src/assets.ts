import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import nodePath from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import fp from "fastify-plugin";
import config from "~/config";

const assetsDir = nodePath.join(
  nodePath.dirname(fileURLToPath(import.meta.url)),
  "assets",
);

// .woff2 specifically excluded here because they are referenced in .css files
// where we can't automatically add cache-breakers.
const assetExtensions = new Set([".css", ".mjs", ".svg", ".png", ".apng"]);

function computeAssetHashes(dir: string): Map<string, string> {
  const hashes = new Map<string, string>();

  for (const entry of readdirSync(dir, { recursive: true })) {
    const relativePath = entry.toString();
    if (!assetExtensions.has(nodePath.extname(relativePath))) {
      continue;
    }

    const content = readFileSync(nodePath.join(dir, relativePath));
    const hash = createHash("sha256")
      .update(content)
      .digest("hex")
      .slice(0, 10);
    hashes.set(relativePath, hash);
  }

  return hashes;
}

/**
 * Map from file paths (relative to `/assets`) to truncated content hashes.
 */
export const assetHashes = computeAssetHashes(assetsDir);

export default fp(async (fastify) => {
  fastify.register(fastifyStatic, {
    root: assetsDir,
    prefix: "/assets/",
    preCompressed: config.production,
    maxAge: "1y",
    immutable: true,
  });
});

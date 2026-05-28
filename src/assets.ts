import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import nodePath from "node:path";
import { fileURLToPath } from "node:url";
import fastifyStatic from "@fastify/static";
import fp from "fastify-plugin";
import config from "~/config";
import type { ImportMap, ModuleSpecifierMap } from "./types/import-map";

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

const assetHashes = computeAssetHashes(assetsDir);

function generateImportMap(): ImportMap {
  const imports: ModuleSpecifierMap = {};

  for (const [assetPath, hash] of assetHashes.entries()) {
    if (!assetPath.endsWith(".mjs")) {
      continue;
    }

    imports[`/assets/${assetPath}`] = `/assets/${assetPath}?v=${hash}`;
  }

  return { imports };
}

const importMap = generateImportMap();
export const importMapJson = JSON.stringify(importMap);
export const importMapCspHash =
  `'sha256-${createHash("sha256").update(importMapJson).digest("base64")}'` as const;

export function assetPath(filePath: string): string {
  const path = `/assets/${filePath}`;
  const hash = assetHashes.get(filePath);
  if (!hash) {
    return path;
  }

  return `${path}?v=${hash}`;
}

export default fp(async (fastify) => {
  fastify.register(fastifyStatic, {
    root: assetsDir,
    prefix: "/assets/",
    preCompressed: config.production,
    maxAge: "1y",
    immutable: true,
  });
});

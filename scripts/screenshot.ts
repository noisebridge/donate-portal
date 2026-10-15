#!/usr/bin/env bun

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { firefox } from "playwright";
import config from "~/config";

const OUT = "screenshot.png";

const server = Bun.spawn(["bun", "run", "start"], {
  stdout: "inherit",
  stderr: "inherit",
});

try {
  // Wait for the server to accept connections.
  for (let i = 0; ; i++) {
    try {
      await fetch(config.baseUrl);
      break;
    } catch {
      if (i > 60) throw new Error(`Server never came up at ${config.baseUrl}`);
      await Bun.sleep(500);
    }
  }

  // Same macOS 27 Firefox workaround as playwright.config.ts.
  const browser = await firefox.launch(
    process.platform === "darwin"
      ? {
          env: {
            ...process.env,
            CFFIXED_USER_HOME: mkdtempSync(
              path.join(tmpdir(), "playwright-firefox-home-"),
            ),
          },
        }
      : {},
  );
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 },
  });
  await page.goto(config.baseUrl, { waitUntil: "networkidle" });
  await page.screenshot({ path: OUT, fullPage: true });
  await browser.close();
  console.log(`Wrote ${OUT}`);
} finally {
  server.kill();
}

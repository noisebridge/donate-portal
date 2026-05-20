import { test as base } from "@playwright/test";

export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    if (!baseURL) {
      return;
    }

    const errors: string[] = [];

    page.on("pageerror", (error) => {
      if (!page.url().startsWith(baseURL)) {
        return;
      }

      errors.push(`Uncaught: ${error.message}`);
    });

    page.on("console", (msg) => {
      if (msg.type() !== "error") {
        return;
      }

      // Ignore errors on third-party pages
      if (!page.url().startsWith(baseURL)) {
        return;
      }

      // Ignore errors originating from third-party scripts
      const location = msg.location();
      if (location.url && !location.url.startsWith(baseURL)) {
        return;
      }

      errors.push(`console.error: ${msg.text()}`);
    });

    await use(page);

    if (errors.length > 0) {
      throw new Error(`JS errors on page:\n${errors.join("\n")}`);
    }
  },
});

export { expect } from "@playwright/test";

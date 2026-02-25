import { test as base } from "@playwright/test";

export const test = base.extend({
  page: async ({ page, baseURL }, use) => {
    const errors: string[] = [];

    page.on("pageerror", (error) => {
      if (baseURL && page.url().startsWith(baseURL)) {
        errors.push(`Uncaught: ${error.message}`);
      }
    });

    page.on("console", (msg) => {
      if (msg.type() === "error" && baseURL && page.url().startsWith(baseURL)) {
        errors.push(`console.error: ${msg.text()}`);
      }
    });

    await use(page);

    if (errors.length > 0) {
      throw new Error(`JS errors on page:\n${errors.join("\n")}`);
    }
  },
});

export { expect } from "@playwright/test";

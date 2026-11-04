// Use base test for this file because our extended test function throws on the
// console errors we want to inspect.
import { type Page, test } from "@playwright/test";

export function expectConsoleError(page: Page, expectedText: string) {
  return page.waitForEvent("console", {
    predicate: (msg) =>
      msg.type() === "error" && msg.text().includes(expectedText),
    timeout: 5000,
  });
}

test.describe("Content Security Policy", { tag: "@serial" }, () => {
  test.describe.configure({ mode: "serial" });
  test("blocks eval()", async ({ page }) => {
    // Create a fake Stripe script that uses the banned `eval()` function.
    const evalTestURL = "https://js.stripe.com/csp-eval-test.js";
    await page.route(evalTestURL, (route) => {
      route.fulfill({
        contentType: "application/javascript",
        body: 'eval("1");',
      });
    });

    await page.goto("/");

    const violation = expectConsoleError(
      page,
      "blocked a JavaScript eval (script-src)",
    );
    await page.addScriptTag({ url: evalTestURL });
    await violation;
  });

  test("blocks inline scripts", async ({ page }) => {
    await page.goto("/");

    const violation = expectConsoleError(
      page,
      "blocked an inline script (script-src-elem)",
    );
    await page.evaluate(`
      const s = document.createElement("script");
      s.textContent = "console.log('Hello, world!');";
      document.head.appendChild(s);
    `);
    await violation;
  });

  test("blocks inline styles", async ({ page }) => {
    await page.goto("/");

    const violation = expectConsoleError(
      page,
      "blocked an inline style (style-src-elem)",
    );
    await page.evaluate(`
      const style = document.createElement("style");
      style.textContent = "a { color: rgb(255, 0, 0); }";
      document.head.appendChild(style);
    `);
    await violation;
  });
});
